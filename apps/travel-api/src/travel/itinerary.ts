import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@travel/db";
import { ItineraryItemStatus, ItineraryItemType } from "@travel/db/enums";
import {
	type ItineraryDetails,
	itineraryDetails,
} from "@travel/validation/itinerary-item";
import { z } from "zod";
import type { ConversionService } from "../currency/conversion.service";

const itineraryItemType = z.enum(
	Object.values(ItineraryItemType) as [
		ItineraryItemType,
		...ItineraryItemType[],
	],
);

const itineraryItemStatus = z.enum(
	Object.values(ItineraryItemStatus) as [
		ItineraryItemStatus,
		...ItineraryItemStatus[],
	],
);

const currencyCode = z.string().trim().length(3).toUpperCase();

export const itineraryItemInput = z
	.object({
		type: itineraryItemType,
		supplierId: z.string().nullable().default(null),
		confirmationCode: z.string().trim().max(120).nullable().default(null),
		status: itineraryItemStatus.default("QUOTED"),
		startsAt: z.string().datetime().nullable().default(null),
		endsAt: z.string().datetime().nullable().default(null),
		startLocation: z.string().trim().max(200).nullable().default(null),
		endLocation: z.string().trim().max(200).nullable().default(null),
		description: z.string().trim().max(2000).nullable().default(null),
		paxCount: z.number().int().min(1).max(999).default(1),
		position: z.number().int().min(0).default(0),
		costAmount: z.number().min(0).nullable().default(null),
		costCurrency: currencyCode.nullable().default(null),
		sellAmount: z.number().min(0).nullable().default(null),
		sellCurrency: currencyCode.nullable().default(null),
		details: itineraryDetails,
	})
	.superRefine((item, context) => {
		if (item.details.type !== item.type) {
			context.addIssue({
				code: "custom",
				path: ["details", "type"],
				message: `details.type must match the line type (${item.type}).`,
			});
		}
	});

export type ItineraryItemInput = z.infer<typeof itineraryItemInput>;

function decimalOrNull(value: number | null): Prisma.Decimal | null {
	return value === null ? null : new Prisma.Decimal(value.toFixed(2));
}

function detailsAsJson(details: ItineraryDetails): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue;
}

export async function buildItineraryItemData(
	agencyId: string,
	conversion: ConversionService,
	input: ItineraryItemInput,
) {
	const costAmount = decimalOrNull(input.costAmount);
	const sellAmount = decimalOrNull(input.sellAmount);
	const costCurrency = input.costCurrency;
	const sellCurrency = input.sellCurrency;

	if ((costAmount && !costCurrency) || (sellAmount && !sellCurrency)) {
		throw new BadRequestException(
			"An amount needs a currency on the same line.",
		);
	}

	const cost = costCurrency
		? await conversion.itemFields(agencyId, costAmount, costCurrency)
		: null;
	const sell = sellCurrency
		? await conversion.itemFields(agencyId, sellAmount, sellCurrency)
		: null;

	const baseCurrency =
		cost?.baseCurrency ??
		sell?.baseCurrency ??
		(await conversion.baseCurrencyFor(agencyId));

	return {
		type: input.type,
		supplierId: input.supplierId,
		confirmationCode: input.confirmationCode,
		status: input.status,
		startsAt: input.startsAt ? new Date(input.startsAt) : null,
		endsAt: input.endsAt ? new Date(input.endsAt) : null,
		startLocation: input.startLocation,
		endLocation: input.endLocation,
		description: input.description,
		paxCount: input.paxCount,
		position: input.position,
		costAmount,
		costCurrency,
		sellAmount,
		sellCurrency,
		costBaseAmount: cost?.baseAmount ?? null,
		sellBaseAmount: sell?.baseAmount ?? null,
		baseCurrency,
		fxRate: cost?.fxRate ?? sell?.fxRate ?? null,
		fxRateAt: cost?.fxRateAt ?? sell?.fxRateAt ?? null,
		details: detailsAsJson(input.details),
	};
}

export function itemBaseTotals(
	items: {
		sellBaseAmount: Prisma.Decimal | null;
		costBaseAmount: Prisma.Decimal | null;
	}[],
) {
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

	return { sell, cost, missing };
}
