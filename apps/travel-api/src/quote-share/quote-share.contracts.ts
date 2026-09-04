import { ItineraryItemType, QuoteStatus } from "@travel/db/enums";
import { z } from "zod";

const quoteStatus = z.enum(
	Object.values(QuoteStatus) as [QuoteStatus, ...QuoteStatus[]],
);

const itineraryItemType = z.enum(
	Object.values(ItineraryItemType) as [
		ItineraryItemType,
		...ItineraryItemType[],
	],
);

export const shareQuoteIdInput = z.object({ quoteId: z.string() });

export const createShareInput = z.object({
	quoteId: z.string(),
	expiresInDays: z.number().int().min(1).max(365).nullable().default(null),
});

export type CreateShareInput = z.infer<typeof createShareInput>;

export const sendQuoteInput = z.object({
	quoteId: z.string(),
	to: z.string().trim().email().nullable().default(null),
	message: z.string().trim().max(2000).nullable().default(null),
});

export type SendQuoteInput = z.infer<typeof sendQuoteInput>;

export const shareStatusOutput = z.object({
	enabled: z.boolean(),
	url: z.string().nullable(),
	createdAt: z.string().nullable(),
	expiresAt: z.string().nullable(),
	firstViewAt: z.string().nullable(),
	lastViewAt: z.string().nullable(),
	viewCount: z.number(),
});

export const revokeShareOutput = z.object({ id: z.string() });

export const sendQuoteOutput = z.object({
	delivered: z.boolean(),
	url: z.string(),
	to: z.string().nullable(),
});

export const publicTokenInput = z.object({
	token: z.string().min(20).max(200),
});

export const publicAcceptInput = z.object({
	token: z.string().min(20).max(200),
	optionId: z.string(),
	name: z.string().trim().min(2).max(120),
});

const publicItineraryItemOutput = z.object({
	type: itineraryItemType,
	description: z.string().nullable(),
	startsAt: z.string().nullable(),
	endsAt: z.string().nullable(),
	paxCount: z.number(),
	position: z.number(),
	sellAmount: z.number().nullable(),
	sellCurrency: z.string().nullable(),
	details: z.unknown(),
});

const publicOptionOutput = z.object({
	id: z.string(),
	label: z.string(),
	isRecommended: z.boolean(),
	sellTotalBase: z.number().nullable(),
	baseCurrency: z.string().nullable(),
	priced: z.boolean(),
	items: z.array(publicItineraryItemOutput),
});

export const publicQuoteOutput = z.object({
	agency: z.object({
		name: z.string(),
		legalName: z.string().nullable(),
		logoUrl: z.string().nullable(),
		phone: z.string().nullable(),
		email: z.string().nullable(),
	}),
	quote: z.object({
		folio: z.string(),
		destination: z.string().nullable(),
		travelStartDate: z.string().nullable(),
		travelEndDate: z.string().nullable(),
		paxAdults: z.number(),
		paxChildren: z.number(),
		paxInfants: z.number(),
		validUntil: z.string().nullable(),
		notes: z.string().nullable(),
		terms: z.string().nullable(),
		status: quoteStatus,
		acceptedOptionId: z.string().nullable(),
		expired: z.boolean(),
		canAccept: z.boolean(),
	}),
	customer: z.object({ name: z.string() }),
	options: z.array(publicOptionOutput),
});

export const publicAcceptOutput = z.object({
	folio: z.string(),
	optionId: z.string(),
	acceptedAt: z.string(),
});
