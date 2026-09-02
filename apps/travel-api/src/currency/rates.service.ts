import { Injectable, Logger } from "@nestjs/common";
import type { Db } from "@travel/db";
import { Prisma, RateSource } from "@travel/db";
import {
	CURRENCY_CODES,
	isCurrencyCode,
	normalizeCurrency,
} from "@travel/db/currency";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { CURRENCY } from "./currency-config";

export const RATES_PROVIDER = CURRENCY.rates.provider;

export interface RateRefresh {
	ok: boolean;
	bases: string[];
	written: number;
	reason: string | null;
}

const UNREADABLE_FEED = {
	result: "",
	time_last_update_unix: null,
	rates: {},
	"error-type": null,
};

const openExchangeResponse = z
	.object({
		result: z.string().catch(""),
		time_last_update_unix: z
			.number()
			.refine(Number.isFinite)
			.nullable()
			.catch(null),
		rates: z.record(z.string(), z.json()).catch({}),
		"error-type": z.string().nullable().catch(null),
	})
	.catch(UNREADABLE_FEED);

function parseAsOf(seconds: number | null): Date | null {
	if (seconds === null) return null;
	const date = new Date(seconds * 1000);
	return Number.isNaN(date.getTime()) ? null : date;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class RatesService {
	private readonly logger = new Logger(RatesService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async refreshedAt(): Promise<Date | null> {
		const row = await this.db.exchangeRate.findFirst({
			where: { source: RateSource.FETCHED },
			orderBy: { asOf: "desc" },
			select: { asOf: true },
		});
		return row?.asOf ?? null;
	}

	async bases(): Promise<string[]> {
		const rows = await this.db.agencySettings.findMany({
			select: { baseCurrency: true },
			distinct: ["baseCurrency"],
		});

		const set = new Set<string>(["USD"]);
		for (const row of rows) {
			const code = normalizeCurrency(row.baseCurrency);
			if (isCurrencyCode(code)) set.add(code);
		}
		return [...set].sort();
	}

	async refresh(): Promise<RateRefresh> {
		const bases = await this.bases();
		let written = 0;
		const failed: string[] = [];

		for (const base of bases) {
			const quotes = await this.fetch(base);
			if (!quotes) {
				failed.push(base);
				continue;
			}
			written += await this.store(base, quotes.rates, quotes.asOf);
		}

		if (failed.length === bases.length) {
			return {
				ok: false,
				bases,
				written,
				reason: `Could not reach ${RATES_PROVIDER}. Rates entered by hand are unaffected.`,
			};
		}

		this.logger.log({
			message: "Exchange rates refreshed",
			bases,
			written,
			failed,
		});

		return {
			ok: true,
			bases,
			written,
			reason:
				failed.length > 0
					? `Some bases did not refresh: ${failed.join(", ")}.`
					: null,
		};
	}

	private async store(
		base: string,
		rates: Map<string, Prisma.Decimal>,
		asOf: Date,
	): Promise<number> {
		let written = 0;

		for (const [quoteCurrency, rate] of rates) {
			await this.db.exchangeRate.upsert({
				where: {
					baseCurrency_quoteCurrency_source: {
						baseCurrency: base,
						quoteCurrency,
						source: RateSource.FETCHED,
					},
				},
				create: {
					baseCurrency: base,
					quoteCurrency,
					rate,
					asOf,
					source: RateSource.FETCHED,
					provider: RATES_PROVIDER,
				},
				update: { rate, asOf, provider: RATES_PROVIDER },
			});

			written += 1;
		}

		const supported = [...CURRENCY_CODES];

		const stale = await this.db.exchangeRate.deleteMany({
			where: {
				source: RateSource.FETCHED,
				OR: [
					{ baseCurrency: { notIn: supported } },
					{ quoteCurrency: { notIn: supported } },
				],
			},
		});

		if (stale.count > 0) {
			this.logger.log({
				message: "Dropped fetched rates for unsupported currencies",
				dropped: stale.count,
			});
		}

		return written;
	}

	private async fetch(
		base: string,
	): Promise<{ rates: Map<string, Prisma.Decimal>; asOf: Date } | null> {
		for (let attempt = 1; attempt <= CURRENCY.rates.attempts; attempt += 1) {
			const quotes = await this.attempt(base, attempt);
			if (quotes) return quotes;

			if (attempt < CURRENCY.rates.attempts) {
				await wait(CURRENCY.rates.retryDelayMs);
			}
		}

		return null;
	}

	private async attempt(
		base: string,
		attempt: number,
	): Promise<{ rates: Map<string, Prisma.Decimal>; asOf: Date } | null> {
		try {
			const response = await fetch(
				`${CURRENCY.rates.url}/${encodeURIComponent(base)}`,
				{
					headers: { accept: "application/json" },
					signal: AbortSignal.timeout(CURRENCY.rates.timeoutMs),
				},
			);

			if (!response.ok) {
				this.logger.warn({
					message: "Exchange rate request failed",
					status: response.status,
					base,
					attempt,
				});
				return null;
			}

			const body = openExchangeResponse.parse(await response.json());

			if (body.result !== "success") {
				this.logger.warn({
					message: "Exchange rate provider refused the request",
					base,
					attempt,
					errorType: body["error-type"],
				});
				return null;
			}

			const asOf = parseAsOf(body.time_last_update_unix) ?? new Date();
			const rates = new Map<string, Prisma.Decimal>();

			for (const [code, value] of Object.entries(body.rates)) {
				const quoteCurrency = normalizeCurrency(code);
				if (!isCurrencyCode(quoteCurrency)) continue;
				if (quoteCurrency === normalizeCurrency(base)) continue;

				const perBase = Number(value);
				if (!Number.isFinite(perBase) || perBase <= 0) continue;

				rates.set(
					quoteCurrency,
					new Prisma.Decimal(1).dividedBy(perBase).toDecimalPlaces(10),
				);
			}

			if (rates.size === 0) {
				this.logger.warn({
					message: "Exchange rate response carried no usable rates",
					base,
					attempt,
				});
				return null;
			}

			return { rates, asOf };
		} catch (error) {
			this.logger.warn({
				message: "Exchange rates unavailable",
				base,
				attempt,
				reason: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}
}
