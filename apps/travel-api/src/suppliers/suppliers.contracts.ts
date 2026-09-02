import { SupplierKind } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { listInput } from "../trpc/list-input";

const supplierKind = z.enum(
	Object.values(SupplierKind) as [SupplierKind, ...SupplierKind[]],
);

const currencyCode = z.string().trim().length(3).toUpperCase();

export const supplierListInput = listInput.extend({
	kind: z.array(supplierKind).default([]),
	archived: z.boolean().default(false),
});

export type SupplierListInput = z.infer<typeof supplierListInput>;

export const supplierCreateInput = z.object({
	kind: supplierKind.default("OTHER"),
	name: z.string().trim().min(1, "A supplier needs a name.").max(200),
	email: z
		.string()
		.trim()
		.email("That is not an email address.")
		.nullable()
		.default(null),
	phone: z.string().trim().max(40).nullable().default(null),
	defaultCommissionRate: z.number().min(0).max(1).nullable().default(null),
	paymentTermsDays: z.number().int().min(0).max(365).nullable().default(null),
	defaultCurrency: currencyCode.nullable().default(null),
	notes: z.string().trim().max(2000).nullable().default(null),
});

export type SupplierCreateInput = z.infer<typeof supplierCreateInput>;

export const supplierUpdateArgs = z.object({
	id: z.string(),
	data: supplierCreateInput.partial(),
});

export const supplierIdInput = z.object({ id: z.string() });

export const supplierBulkInput = bulkIdsInput;

export const supplierRowOutput = z.object({
	id: z.string(),
	kind: supplierKind,
	name: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	defaultCurrency: z.string().nullable(),
	quoteItemCount: z.number(),
	bookingItemCount: z.number(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
});

export type SupplierRow = z.infer<typeof supplierRowOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const supplierListOutput = z.object({
	rows: z.array(supplierRowOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
});

export const supplierDetailOutput = supplierRowOutput.extend({
	defaultCommissionRate: z.number().nullable(),
	paymentTermsDays: z.number().nullable(),
	notes: z.string().nullable(),
	updatedAt: z.string(),
});

export const supplierSummaryOutput = z.object({
	id: z.string(),
	name: z.string(),
});

export const supplierArchiveResultOutput = z.object({
	id: z.string(),
	archivedAt: z.string().nullable(),
});

export const supplierBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const supplierOptionsInput = z.object({ q: z.string().default("") });

export const supplierOptionOutput = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
		kind: supplierKind,
	}),
);
