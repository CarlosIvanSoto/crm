import { CustomerType } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { listInput } from "../trpc/list-input";

const customerType = z.enum(
	Object.values(CustomerType) as [CustomerType, ...CustomerType[]],
);

export const customerListInput = listInput.extend({
	type: z.array(customerType).default([]),
	owner: z.array(z.string()).default([]),
	archived: z.boolean().default(false),
});

export type CustomerListInput = z.infer<typeof customerListInput>;

export const customerCreateInput = z.object({
	type: customerType.default("PERSON"),
	name: z.string().trim().min(1, "A customer needs a name.").max(200),
	legalName: z.string().trim().max(200).nullable().default(null),
	taxId: z.string().trim().max(40).nullable().default(null),
	taxRegime: z.string().trim().max(120).nullable().default(null),
	email: z
		.string()
		.trim()
		.email("That is not an email address.")
		.nullable()
		.default(null),
	phone: z.string().trim().max(40).nullable().default(null),
	whatsapp: z.string().trim().max(40).nullable().default(null),
	ownerId: z.string().nullable().default(null),
});

export type CustomerCreateInput = z.infer<typeof customerCreateInput>;

export const customerUpdateArgs = z.object({
	id: z.string(),
	data: customerCreateInput.partial(),
});

export const customerIdInput = z.object({ id: z.string() });

export const customerBulkInput = bulkIdsInput;

export const customerBulkOwnerInput = bulkIdsInput.extend({
	ownerId: z.string().nullable(),
});

const ownerOutput = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	})
	.nullable();

export const customerRowOutput = z.object({
	id: z.string(),
	type: customerType,
	name: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	owner: ownerOutput,
	quoteCount: z.number(),
	bookingCount: z.number(),
	lastActivityAt: z.string().nullable(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
});

export type CustomerRow = z.infer<typeof customerRowOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const customerListOutput = z.object({
	rows: z.array(customerRowOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
});

export const customerDetailOutput = customerRowOutput.extend({
	legalName: z.string().nullable(),
	taxId: z.string().nullable(),
	taxRegime: z.string().nullable(),
	whatsapp: z.string().nullable(),
	updatedAt: z.string(),
});

export const customerSummaryOutput = z.object({
	id: z.string(),
	name: z.string(),
});

export const customerArchiveResultOutput = z.object({
	id: z.string(),
	archivedAt: z.string().nullable(),
});

export const customerBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const customerOptionsInput = z.object({ q: z.string().default("") });

export const customerOptionOutput = z.array(
	z.object({ id: z.string(), name: z.string(), email: z.string().nullable() }),
);
