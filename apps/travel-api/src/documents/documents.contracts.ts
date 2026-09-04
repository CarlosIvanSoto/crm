import { DocumentKind } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { listInput } from "../trpc/list-input";

const documentKind = z.enum(
	Object.values(DocumentKind) as [DocumentKind, ...DocumentKind[]],
);

const anchorInput = {
	bookingId: z.string().optional(),
	travelerId: z.string().optional(),
};

const ANCHOR_MESSAGE = "A document has to be about a booking or a traveler.";

export const storageStatusOutput = z.object({
	enabled: z.boolean(),
	maxBytes: z.number(),
	allowedContentTypes: z.array(z.string()),
});

export const uploadTokenInput = z
	.object({
		...anchorInput,
		filename: z.string().trim().min(1).max(200),
		contentType: z.string().trim().min(1),
		sizeBytes: z.number().int().positive(),
		kind: documentKind,
	})
	.refine((input) => Boolean(input.bookingId || input.travelerId), {
		message: ANCHOR_MESSAGE,
	});

export type UploadTokenInput = z.infer<typeof uploadTokenInput>;

export const uploadTokenOutput = z.object({
	token: z.string(),
	pathname: z.string(),
});

export const createDocumentInput = z
	.object({
		...anchorInput,
		kind: documentKind,
		pathname: z.string().trim().min(1),
		url: z.string().trim().min(1),
		filename: z.string().trim().min(1).max(200),
		contentType: z.string().trim().min(1).nullable().default(null),
		sizeBytes: z.number().int().positive().nullable().default(null),
	})
	.refine((input) => Boolean(input.bookingId || input.travelerId), {
		message: ANCHOR_MESSAGE,
	});

export type CreateDocumentInput = z.infer<typeof createDocumentInput>;

export const documentListInput = listInput.extend({
	...anchorInput,
	kind: z.array(documentKind).default([]),
});

export type DocumentListInput = z.infer<typeof documentListInput>;

export const documentIdInput = z.object({ id: z.string() });

export const downloadUrlOutput = z.object({
	url: z.string(),
	expiresAt: z.string(),
});

export const updateDocumentInput = z.object({
	id: z.string(),
	kind: documentKind.optional(),
	filename: z.string().trim().min(1).max(200).optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentInput>;

export const removeManyInput = bulkIdsInput;

const uploaderOutput = z.object({ id: z.string(), name: z.string() });

export const documentEntryOutput = z.object({
	id: z.string(),
	kind: documentKind,
	filename: z.string(),
	contentType: z.string().nullable(),
	sizeBytes: z.number().nullable(),
	bookingId: z.string().nullable(),
	travelerId: z.string().nullable(),
	uploadedBy: uploaderOutput,
	createdAt: z.string(),
});

export type DocumentEntry = z.infer<typeof documentEntryOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const documentListOutput = z.object({
	rows: z.array(documentEntryOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
});

export type DocumentListResult = z.infer<typeof documentListOutput>;

export const bulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const removeOutput = z.object({ id: z.string() });
