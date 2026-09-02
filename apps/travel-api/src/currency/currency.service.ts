import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
} from "@nestjs/common";
import { type AgencyRole, canManageAgency } from "@travel/auth";
import { agencyDb, type Db, Prisma, RateSource } from "@travel/db";
import {
	CURRENCIES,
	currencyName,
	normalizeCurrency,
} from "@travel/db/currency";
import { InjectDatabase } from "../database/database.constants";
import { ConversionService } from "./conversion.service";
import type { CurrencyRate, CurrencySettings } from "./currency.contracts";
import { RatesService } from "./rates.service";

@Injectable()
export class CurrencyService {
	private readonly logger = new Logger(CurrencyService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
		private readonly rates: RatesService,
	) {}

	async settings(
		agencyId: string,
		role: AgencyRole,
	): Promise<CurrencySettings> {
		const baseCurrency = await this.conversion.baseCurrencyFor(agencyId);

		const [rows, refreshedAt, unconverted] = await Promise.all([
			this.db.exchangeRate.findMany({
				where: { baseCurrency },
				select: {
					quoteCurrency: true,
					rate: true,
					asOf: true,
					source: true,
					provider: true,
				},
			}),
			this.rates.refreshedAt(),
			this.conversion.unconverted(agencyId),
		]);

		const manual = new Set(
			rows
				.filter((row) => row.source === RateSource.MANUAL)
				.map((row) => row.quoteCurrency),
		);

		const effective = new Map<string, CurrencyRate>();

		for (const row of rows) {
			const currency = normalizeCurrency(row.quoteCurrency);

			if (row.source === RateSource.FETCHED && manual.has(row.quoteCurrency)) {
				continue;
			}

			effective.set(currency, {
				currency,
				name: currencyName(currency),
				rate: row.rate.toNumber(),
				asOf: row.asOf.toISOString(),
				source: row.source,
				provider: row.provider,
				overriding:
					row.source === RateSource.MANUAL && manual.has(row.quoteCurrency),
			});
		}

		return {
			baseCurrency,
			refreshedAt: refreshedAt?.toISOString() ?? null,
			rates: [...effective.values()].sort((a, b) =>
				a.currency.localeCompare(b.currency),
			),
			unconverted,
			catalog: [...CURRENCIES],
			canManage: canManageAgency(role),
		};
	}

	async setBaseCurrency(
		agencyId: string,
		role: AgencyRole,
		code: string,
	): Promise<CurrencySettings> {
		this.requireManager(role);

		const currency = normalizeCurrency(code);
		const current = await this.conversion.baseCurrencyFor(agencyId);

		if (currency === current) return this.settings(agencyId, role);

		const scoped = agencyDb(this.db, agencyId);
		await scoped.agencySettings.upsert({
			where: { agencyId },
			create: { agencyId, baseCurrency: currency },
			update: { baseCurrency: currency },
		});

		const refresh = await this.rates.refresh();
		const filled = await this.conversion.fillMissing(agencyId);

		this.logger.log({
			message: "Agency base currency changed",
			agencyId,
			from: current,
			to: currency,
			ratesWritten: refresh.written,
			filled: filled.converted,
			stillMissing: filled.missing,
		});

		return this.settings(agencyId, role);
	}

	async setManualRate(
		agencyId: string,
		role: AgencyRole,
		code: string,
		rate: number,
	): Promise<CurrencySettings> {
		this.requireManager(role);

		const quoteCurrency = normalizeCurrency(code);
		const baseCurrency = await this.conversion.baseCurrencyFor(agencyId);

		if (quoteCurrency === baseCurrency) {
			throw new BadRequestException(
				`${baseCurrency} is the base currency — its rate is always 1.`,
			);
		}

		const asOf = new Date();

		await this.db.exchangeRate.upsert({
			where: {
				baseCurrency_quoteCurrency_source: {
					baseCurrency,
					quoteCurrency,
					source: RateSource.MANUAL,
				},
			},
			create: {
				baseCurrency,
				quoteCurrency,
				rate: new Prisma.Decimal(rate),
				asOf,
				source: RateSource.MANUAL,
			},
			update: { rate: new Prisma.Decimal(rate), asOf },
		});

		const filled = await this.conversion.fillMissing(agencyId);

		this.logger.log({
			message: "Manual exchange rate saved",
			agencyId,
			baseCurrency,
			quoteCurrency,
			filled: filled.converted,
		});

		return this.settings(agencyId, role);
	}

	async removeManualRate(
		agencyId: string,
		role: AgencyRole,
		code: string,
	): Promise<CurrencySettings> {
		this.requireManager(role);

		const quoteCurrency = normalizeCurrency(code);
		const baseCurrency = await this.conversion.baseCurrencyFor(agencyId);

		await this.db.exchangeRate.deleteMany({
			where: { baseCurrency, quoteCurrency, source: RateSource.MANUAL },
		});

		this.logger.log({
			message: "Manual exchange rate removed",
			agencyId,
			baseCurrency,
			quoteCurrency,
		});

		return this.settings(agencyId, role);
	}

	async refresh(agencyId: string, role: AgencyRole): Promise<CurrencySettings> {
		this.requireManager(role);

		const refresh = await this.rates.refresh();

		if (!refresh.ok) {
			throw new BadRequestException(refresh.reason ?? "Could not fetch rates.");
		}

		await this.conversion.fillMissing(agencyId);

		return this.settings(agencyId, role);
	}

	private requireManager(role: AgencyRole): void {
		if (!canManageAgency(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change how money is reported.",
			);
		}
	}
}
