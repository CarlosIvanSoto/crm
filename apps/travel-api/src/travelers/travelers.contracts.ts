import { TravelDocumentType } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { listInput } from "../trpc/list-input";

const documentType = z.enum(
	Object.values(TravelDocumentType) as [
		TravelDocumentType,
		...TravelDocumentType[],
	],
);

export const travelerListInput = listInput.extend({
	customer: z.array(z.string()).default([]),
	documentType: z.array(documentType).default([]),
	archived: z.boolean().default(false),
});

export type TravelerListInput = z.infer<typeof travelerListInput>;

export const travelerCreateInput = z.object({
	firstName: z
		.string()
		.trim()
		.min(1, "A traveler needs a first name.")
		.max(120),
	lastName: z.string().trim().min(1, "A traveler needs a last name.").max(120),
	dateOfBirth: z.string().datetime().nullable().default(null),
	gender: z.string().trim().max(40).nullable().default(null),
	nationality: z.string().trim().max(80).nullable().default(null),
	documentType: documentType.nullable().default(null),
	documentNumber: z.string().trim().max(80).nullable().default(null),
	documentIssuedCountry: z.string().trim().max(80).nullable().default(null),
	documentExpiresAt: z.string().datetime().nullable().default(null),
	dietaryNotes: z.string().trim().max(2000).nullable().default(null),
	medicalNotes: z.string().trim().max(2000).nullable().default(null),
	customerId: z.string().nullable().default(null),
});

export type TravelerCreateInput = z.infer<typeof travelerCreateInput>;

export const travelerUpdateArgs = z.object({
	id: z.string(),
	data: travelerCreateInput.partial(),
});

export const travelerIdInput = z.object({ id: z.string() });

export const travelerBulkInput = bulkIdsInput;

const loyaltyEntryInput = z.object({
	supplierId: z.string().nullable().default(null),
	programName: z.string().trim().min(1, "A program needs a name.").max(120),
	number: z.string().trim().min(1, "A program needs a number.").max(80),
});

export const setLoyaltyInput = z.object({
	id: z.string(),
	entries: z.array(loyaltyEntryInput).max(50),
});

export type SetLoyaltyInput = z.infer<typeof setLoyaltyInput>;

const loyaltyOutput = z.object({
	id: z.string(),
	supplierId: z.string().nullable(),
	programName: z.string(),
	number: z.string(),
});

export const travelerRowOutput = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	nationality: z.string().nullable(),
	documentType: documentType.nullable(),
	documentNumber: z.string().nullable(),
	documentExpiresAt: z.string().nullable(),
	customerId: z.string().nullable(),
	customerName: z.string().nullable(),
	bookingCount: z.number(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
});

export type TravelerRow = z.infer<typeof travelerRowOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const travelerListOutput = z.object({
	rows: z.array(travelerRowOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
});

export const travelerDetailOutput = travelerRowOutput.extend({
	dateOfBirth: z.string().nullable(),
	gender: z.string().nullable(),
	documentIssuedCountry: z.string().nullable(),
	dietaryNotes: z.string().nullable(),
	medicalNotes: z.string().nullable(),
	loyalty: z.array(loyaltyOutput),
	updatedAt: z.string(),
});

export const travelerSummaryOutput = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string(),
});

export const travelerArchiveResultOutput = z.object({
	id: z.string(),
	archivedAt: z.string().nullable(),
});

export const travelerBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const travelerOptionsInput = z.object({ q: z.string().default("") });

export const travelerOptionOutput = z.array(
	z.object({
		id: z.string(),
		firstName: z.string(),
		lastName: z.string(),
	}),
);
