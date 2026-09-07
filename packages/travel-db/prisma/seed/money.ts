import { db } from "../../src/client";
import { minorUnitsOf } from "../../src/currency";
import { convertToBase } from "../../src/fx";
import { Prisma } from "../../src/generated/prisma/client";

export interface FxColumns {
	amount: Prisma.Decimal | null;
	currency: string | null;
	baseAmount: Prisma.Decimal | null;
	baseCurrency: string | null;
	fxRate: Prisma.Decimal | null;
	fxRateAt: Date | null;
}

export function toDecimal(amount: number, currency: string): Prisma.Decimal {
	return new Prisma.Decimal(amount.toFixed(minorUnitsOf(currency)));
}

export async function withFx(
	amount: number,
	currency: string,
	base: string,
): Promise<FxColumns & { amount: Prisma.Decimal }>;
export async function withFx(
	amount: number | null,
	currency: string,
	base: string,
): Promise<FxColumns>;
export async function withFx(
	amount: number | null,
	currency: string,
	base: string,
): Promise<FxColumns> {
	if (amount === null) {
		return {
			amount: null,
			currency,
			baseAmount: null,
			baseCurrency: null,
			fxRate: null,
			fxRateAt: null,
		};
	}

	const decimal = toDecimal(amount, currency);
	const conversion = await convertToBase(db, decimal, currency, base);

	return {
		amount: decimal,
		currency,
		baseAmount: conversion?.baseAmount ?? null,
		baseCurrency: conversion?.baseCurrency ?? null,
		fxRate: conversion?.fxRate ?? null,
		fxRateAt: conversion?.fxRateAt ?? null,
	};
}

export interface ItemFxInput {
	costAmount: number | null;
	costCurrency: string | null;
	sellAmount: number | null;
	sellCurrency: string | null;
}

export interface ItemFxColumns {
	costAmount: Prisma.Decimal | null;
	costCurrency: string | null;
	sellAmount: Prisma.Decimal | null;
	sellCurrency: string | null;
	costBaseAmount: Prisma.Decimal | null;
	sellBaseAmount: Prisma.Decimal | null;
	baseCurrency: string;
	fxRate: Prisma.Decimal | null;
	fxRateAt: Date | null;
}

export async function itemFx(
	input: ItemFxInput,
	base: string,
): Promise<ItemFxColumns> {
	const cost = input.costCurrency
		? await withFx(input.costAmount, input.costCurrency, base)
		: null;
	const sell = input.sellCurrency
		? await withFx(input.sellAmount, input.sellCurrency, base)
		: null;

	return {
		costAmount: cost?.amount ?? null,
		costCurrency: input.costCurrency,
		sellAmount: sell?.amount ?? null,
		sellCurrency: input.sellCurrency,
		costBaseAmount: cost?.baseAmount ?? null,
		sellBaseAmount: sell?.baseAmount ?? null,
		baseCurrency: cost?.baseCurrency ?? sell?.baseCurrency ?? base,
		fxRate: cost?.fxRate ?? sell?.fxRate ?? null,
		fxRateAt: cost?.fxRateAt ?? sell?.fxRateAt ?? null,
	};
}

export interface BaseTotals {
	sell: Prisma.Decimal | null;
	cost: Prisma.Decimal | null;
}

export function itemBaseTotals(
	items: {
		sellBaseAmount: Prisma.Decimal | null;
		costBaseAmount: Prisma.Decimal | null;
	}[],
): BaseTotals {
	let sell = new Prisma.Decimal(0);
	let cost = new Prisma.Decimal(0);
	let missing = 0;

	for (const item of items) {
		if (item.sellBaseAmount === null || item.costBaseAmount === null) {
			missing += 1;
			continue;
		}
		sell = sell.plus(item.sellBaseAmount);
		cost = cost.plus(item.costBaseAmount);
	}

	if (missing > 0) {
		return { sell: null, cost: null };
	}
	return { sell, cost };
}

export function decimalString(value: Prisma.Decimal | null): string | null {
	return value === null ? null : value.toString();
}
