import { Injectable, Logger } from "@nestjs/common";
import { agencyDb, type Db, type Prisma } from "@travel/db";
import { normalizeCurrency } from "@travel/db/currency";
import { convertToBase } from "@travel/db/fx";
import { InjectDatabase } from "../database/database.constants";
import { CURRENCY } from "./currency-config";

export interface FxFields {
	baseAmount: Prisma.Decimal | null;
	baseCurrency: string | null;
	fxRate: Prisma.Decimal | null;
	fxRateAt: Date | null;
}

export interface Unconverted {
	count: number;
	currencies: string[];
}

export interface FillResult {
	converted: number;
	missing: number;
}

type BaseAmountPatch = {
	costBaseAmount?: Prisma.Decimal;
	sellBaseAmount?: Prisma.Decimal;
	baseCurrency?: string;
	fxRate?: Prisma.Decimal;
	fxRateAt?: Date;
};

type ItemRow = {
	id: string;
	costAmount: Prisma.Decimal | null;
	costCurrency: string | null;
	costBaseAmount: Prisma.Decimal | null;
	sellAmount: Prisma.Decimal | null;
	sellCurrency: string | null;
	sellBaseAmount: Prisma.Decimal | null;
};

const EMPTY: FxFields = {
	baseAmount: null,
	baseCurrency: null,
	fxRate: null,
	fxRateAt: null,
};

const ITEM_GAP = {
	OR: [
		{ costAmount: { not: null }, costBaseAmount: null },
		{ sellAmount: { not: null }, sellBaseAmount: null },
	],
};

const ITEM_SELECT = {
	id: true,
	costAmount: true,
	costCurrency: true,
	costBaseAmount: true,
	sellAmount: true,
	sellCurrency: true,
	sellBaseAmount: true,
} as const;

@Injectable()
export class ConversionService {
	private readonly logger = new Logger(ConversionService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async baseCurrencyFor(agencyId: string): Promise<string> {
		const scoped = agencyDb(this.db, agencyId);
		const settings = await scoped.agencySettings.findFirst({
			where: { agencyId },
			select: { baseCurrency: true },
		});
		return normalizeCurrency(settings?.baseCurrency ?? "USD");
	}

	async itemFields(
		agencyId: string,
		amount: Prisma.Decimal | null,
		currency: string,
	): Promise<FxFields> {
		if (amount === null) return EMPTY;

		const base = await this.baseCurrencyFor(agencyId);
		const converted = await convertToBase(this.db, amount, currency, base);

		if (!converted) return EMPTY;

		return {
			baseAmount: converted.baseAmount,
			baseCurrency: converted.baseCurrency,
			fxRate: converted.fxRate,
			fxRateAt: converted.fxRateAt,
		};
	}

	async fillMissingAllAgencies(): Promise<FillResult> {
		const agencies = await this.db.organization.findMany({
			select: { id: true },
		});

		let converted = 0;
		let missing = 0;

		for (const agency of agencies) {
			const result = await this.fillMissing(agency.id);
			converted += result.converted;
			missing += result.missing;
		}

		return { converted, missing };
	}

	async unconverted(agencyId: string): Promise<Unconverted> {
		const scoped = agencyDb(this.db, agencyId);
		const currencies = new Set<string>();
		let count = 0;

		const [quoteItems, bookingItems, payments, supplierPayments] =
			await Promise.all([
				scoped.quoteItem.findMany({
					where: ITEM_GAP,
					select: { costCurrency: true, sellCurrency: true },
				}),
				scoped.bookingItem.findMany({
					where: ITEM_GAP,
					select: { costCurrency: true, sellCurrency: true },
				}),
				scoped.payment.findMany({
					where: { baseAmount: null },
					select: { currency: true },
				}),
				scoped.supplierPayment.findMany({
					where: { baseAmount: null },
					select: { currency: true },
				}),
			]);

		for (const row of [...quoteItems, ...bookingItems]) {
			if (row.costCurrency) currencies.add(normalizeCurrency(row.costCurrency));
			if (row.sellCurrency) currencies.add(normalizeCurrency(row.sellCurrency));
			count += 1;
		}
		for (const row of [...payments, ...supplierPayments]) {
			currencies.add(normalizeCurrency(row.currency));
			count += 1;
		}

		return { count, currencies: [...currencies].sort() };
	}

	async fillMissing(agencyId: string): Promise<FillResult> {
		const base = await this.baseCurrencyFor(agencyId);
		const scoped = agencyDb(this.db, agencyId);
		const cap = CURRENCY.fillMissing.maxRowsPerRun;

		let converted = 0;
		let missing = 0;

		const [quoteItems, bookingItems, payments, supplierPayments] =
			await Promise.all([
				scoped.quoteItem.findMany({
					where: ITEM_GAP,
					select: ITEM_SELECT,
					take: cap,
				}),
				scoped.bookingItem.findMany({
					where: ITEM_GAP,
					select: ITEM_SELECT,
					take: cap,
				}),
				scoped.payment.findMany({
					where: { baseAmount: null },
					select: { id: true, amount: true, currency: true },
					take: cap,
				}),
				scoped.supplierPayment.findMany({
					where: { baseAmount: null },
					select: { id: true, amount: true, currency: true },
					take: cap,
				}),
			]);

		for (const row of quoteItems) {
			const patch = await this.itemPatch(row, base);
			if (!patch) {
				missing += 1;
				continue;
			}
			await scoped.quoteItem.update({ where: { id: row.id }, data: patch });
			converted += 1;
		}

		for (const row of bookingItems) {
			const patch = await this.itemPatch(row, base);
			if (!patch) {
				missing += 1;
				continue;
			}
			await scoped.bookingItem.update({ where: { id: row.id }, data: patch });
			converted += 1;
		}

		const fromPayments = await this.writePaymentBases(
			scoped,
			base,
			payments,
			"payment",
		);
		const fromSupplierPayments = await this.writePaymentBases(
			scoped,
			base,
			supplierPayments,
			"supplierPayment",
		);

		converted += fromPayments.converted + fromSupplierPayments.converted;
		missing += fromPayments.missing + fromSupplierPayments.missing;

		if (converted > 0) {
			this.logger.log({
				message: "Filled missing base amounts",
				agencyId,
				base,
				converted,
				missing,
			});
		}

		return { converted, missing };
	}

	private async writePaymentBases(
		scoped: ReturnType<typeof agencyDb>,
		base: string,
		rows: { id: string; amount: Prisma.Decimal; currency: string }[],
		table: "payment" | "supplierPayment",
	): Promise<FillResult> {
		let converted = 0;
		let missing = 0;

		for (const row of rows) {
			const conversion = await convertToBase(
				this.db,
				row.amount,
				row.currency,
				base,
			);
			if (!conversion) {
				missing += 1;
				continue;
			}

			const data = {
				baseAmount: conversion.baseAmount,
				baseCurrency: conversion.baseCurrency,
				fxRate: conversion.fxRate,
				fxRateAt: conversion.fxRateAt,
			};

			if (table === "payment") {
				await scoped.payment.update({ where: { id: row.id }, data });
			} else {
				await scoped.supplierPayment.update({ where: { id: row.id }, data });
			}

			converted += 1;
		}

		return { converted, missing };
	}

	private async itemPatch(
		row: ItemRow,
		base: string,
	): Promise<BaseAmountPatch | null> {
		const patch: BaseAmountPatch = {};
		let touched = false;

		if (
			row.costAmount !== null &&
			row.costBaseAmount === null &&
			row.costCurrency
		) {
			const conversion = await convertToBase(
				this.db,
				row.costAmount,
				row.costCurrency,
				base,
			);
			if (conversion) {
				patch.costBaseAmount = conversion.baseAmount;
				patch.baseCurrency = conversion.baseCurrency;
				patch.fxRate = conversion.fxRate;
				patch.fxRateAt = conversion.fxRateAt;
				touched = true;
			}
		}

		if (
			row.sellAmount !== null &&
			row.sellBaseAmount === null &&
			row.sellCurrency
		) {
			const conversion = await convertToBase(
				this.db,
				row.sellAmount,
				row.sellCurrency,
				base,
			);
			if (conversion) {
				patch.sellBaseAmount = conversion.baseAmount;
				patch.baseCurrency = conversion.baseCurrency;
				patch.fxRate = conversion.fxRate;
				patch.fxRateAt = conversion.fxRateAt;
				touched = true;
			}
		}

		return touched ? patch : null;
	}
}
