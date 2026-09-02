import { QuoteStatus } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { itineraryItemInput } from "../travel/itinerary";
import { listInput } from "../trpc/list-input";

const quoteStatus = z.enum(
	Object.values(QuoteStatus) as [QuoteStatus, ...QuoteStatus[]],
);

export const quoteListInput = listInput.extend({
	status: z.array(quoteStatus).default([]),
	owner: z.array(z.string()).default([]),
	archived: z.boolean().default(false),
});

export type QuoteListInput = z.infer<typeof quoteListInput>;

export const quoteCreateInput = z.object({
	customerId: z.string().min(1, "A quote needs a customer."),
	ownerId: z.string().nullable().default(null),
	destination: z.string().trim().max(200).nullable().default(null),
	currency: z.string().trim().length(3).default("USD"),
	validUntil: z.string().datetime().nullable().default(null),
	travelStartDate: z.string().datetime().nullable().default(null),
	travelEndDate: z.string().datetime().nullable().default(null),
	paxAdults: z.number().int().min(1).max(99).default(1),
	paxChildren: z.number().int().min(0).max(99).default(0),
	paxInfants: z.number().int().min(0).max(99).default(0),
	notes: z.string().trim().max(4000).nullable().default(null),
	terms: z.string().trim().max(8000).nullable().default(null),
});

export type QuoteCreateInput = z.infer<typeof quoteCreateInput>;

export const quoteUpdateArgs = z.object({
	id: z.string(),
	data: quoteCreateInput.partial().extend({
		status: quoteStatus.optional(),
	}),
});

export const quoteIdInput = z.object({ id: z.string() });

export const quoteBulkInput = bulkIdsInput;

export const quoteOptionInput = z.object({
	label: z.string().trim().min(1).max(80),
	position: z.number().int().min(0).default(0),
	isRecommended: z.boolean().default(false),
	items: z.array(itineraryItemInput).default([]),
});

export const setQuoteOptionsInput = z.object({
	id: z.string(),
	options: z.array(quoteOptionInput).min(1, "A quote needs one option."),
});

export const acceptQuoteInput = z.object({
	id: z.string(),
	optionId: z.string(),
});

const ownerOutput = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	})
	.nullable();

export const quoteRowOutput = z.object({
	id: z.string(),
	folio: z.string(),
	status: quoteStatus,
	customer: z.object({ id: z.string(), name: z.string() }),
	owner: ownerOutput,
	destination: z.string().nullable(),
	currency: z.string(),
	travelStartDate: z.string().nullable(),
	validUntil: z.string().nullable(),
	optionCount: z.number(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
});

export type QuoteRow = z.infer<typeof quoteRowOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const quoteListOutput = z.object({
	rows: z.array(quoteRowOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
});

const quoteItemOutput = z.object({
	id: z.string(),
	type: z.string(),
	status: z.string(),
	supplierId: z.string().nullable(),
	description: z.string().nullable(),
	startsAt: z.string().nullable(),
	endsAt: z.string().nullable(),
	paxCount: z.number(),
	position: z.number(),
	costAmount: z.number().nullable(),
	costCurrency: z.string().nullable(),
	sellAmount: z.number().nullable(),
	sellCurrency: z.string().nullable(),
	sellBaseAmount: z.number().nullable(),
	costBaseAmount: z.number().nullable(),
	baseCurrency: z.string().nullable(),
	details: z.unknown(),
});

const quoteOptionOutput = z.object({
	id: z.string(),
	label: z.string(),
	position: z.number(),
	isRecommended: z.boolean(),
	sellTotalBase: z.number().nullable(),
	costTotalBase: z.number().nullable(),
	marginBase: z.number().nullable(),
	baseCurrency: z.string().nullable(),
	unpricedItems: z.number(),
	items: z.array(quoteItemOutput),
});

export const quoteDetailOutput = quoteRowOutput.extend({
	ownerId: z.string().nullable(),
	travelEndDate: z.string().nullable(),
	paxAdults: z.number(),
	paxChildren: z.number(),
	paxInfants: z.number(),
	notes: z.string().nullable(),
	terms: z.string().nullable(),
	sentAt: z.string().nullable(),
	decidedAt: z.string().nullable(),
	updatedAt: z.string(),
	options: z.array(quoteOptionOutput),
});

export const quoteSummaryOutput = z.object({
	id: z.string(),
	folio: z.string(),
});

export const quoteArchiveResultOutput = z.object({
	id: z.string(),
	archivedAt: z.string().nullable(),
});

export const quoteBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const acceptQuoteOutput = z.object({
	quoteId: z.string(),
	bookingId: z.string(),
	bookingFolio: z.string(),
});
