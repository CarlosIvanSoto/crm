import { BookingStatus, PaxType, TravelDocumentType } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { itineraryItemInput } from "../travel/itinerary";
import { listInput } from "../trpc/list-input";

const bookingStatus = z.enum(
	Object.values(BookingStatus) as [BookingStatus, ...BookingStatus[]],
);
const paxType = z.enum(Object.values(PaxType) as [PaxType, ...PaxType[]]);
const documentType = z.enum(
	Object.values(TravelDocumentType) as [
		TravelDocumentType,
		...TravelDocumentType[],
	],
);

export const bookingListInput = listInput.extend({
	status: z.array(bookingStatus).default([]),
	owner: z.array(z.string()).default([]),
	archived: z.boolean().default(false),
});

export type BookingListInput = z.infer<typeof bookingListInput>;

export const bookingCreateInput = z.object({
	customerId: z.string().min(1, "A booking needs a customer."),
	ownerId: z.string().nullable().default(null),
	destination: z.string().trim().max(200).nullable().default(null),
	currency: z.string().trim().length(3).default("USD"),
	travelStartDate: z.string().datetime().nullable().default(null),
	travelEndDate: z.string().datetime().nullable().default(null),
});

export type BookingCreateInput = z.infer<typeof bookingCreateInput>;

export const bookingUpdateArgs = z.object({
	id: z.string(),
	data: bookingCreateInput.partial().extend({
		status: bookingStatus.optional(),
	}),
});

export const bookingIdInput = z.object({ id: z.string() });

export const bookingBulkInput = bulkIdsInput;

export const setBookingItemsInput = z.object({
	id: z.string(),
	items: z.array(itineraryItemInput).default([]),
});

const bookingTravelerInput = z.object({
	firstName: z.string().trim().min(1).max(120),
	lastName: z.string().trim().min(1).max(120),
	dateOfBirth: z.string().datetime().nullable().default(null),
	nationality: z.string().trim().max(60).nullable().default(null),
	documentType: documentType.nullable().default(null),
	documentNumber: z.string().trim().max(60).nullable().default(null),
	documentExpiresAt: z.string().datetime().nullable().default(null),
	paxType: paxType.default("ADULT"),
	isLead: z.boolean().default(false),
});

export const setBookingTravelersInput = z.object({
	id: z.string(),
	travelers: z.array(bookingTravelerInput).default([]),
});

const ownerOutput = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	})
	.nullable();

export const bookingRowOutput = z.object({
	id: z.string(),
	folio: z.string(),
	status: bookingStatus,
	customer: z.object({ id: z.string(), name: z.string() }),
	owner: ownerOutput,
	destination: z.string().nullable(),
	currency: z.string(),
	travelStartDate: z.string().nullable(),
	sellTotalBase: z.number().nullable(),
	costTotalBase: z.number().nullable(),
	marginBase: z.number().nullable(),
	baseCurrency: z.string().nullable(),
	itemCount: z.number(),
	travelerCount: z.number(),
	lastActivityAt: z.string().nullable(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
});

export type BookingRow = z.infer<typeof bookingRowOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const bookingListOutput = z.object({
	rows: z.array(bookingRowOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
});

const bookingItemOutput = z.object({
	id: z.string(),
	type: z.string(),
	status: z.string(),
	supplierId: z.string().nullable(),
	description: z.string().nullable(),
	confirmationCode: z.string().nullable(),
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

const bookingTravelerOutput = z.object({
	id: z.string(),
	travelerId: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	paxType: paxType,
	isLead: z.boolean(),
	documentNumber: z.string().nullable(),
	documentExpiresAt: z.string().nullable(),
});

export const bookingDetailOutput = bookingRowOutput.extend({
	ownerId: z.string().nullable(),
	quoteId: z.string().nullable(),
	travelEndDate: z.string().nullable(),
	updatedAt: z.string(),
	unpricedItems: z.number(),
	items: z.array(bookingItemOutput),
	travelers: z.array(bookingTravelerOutput),
});

export const bookingSummaryOutput = z.object({
	id: z.string(),
	folio: z.string(),
});

export const bookingArchiveResultOutput = z.object({
	id: z.string(),
	archivedAt: z.string().nullable(),
});

export const bookingBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});
