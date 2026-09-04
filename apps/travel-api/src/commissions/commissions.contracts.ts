import { CommissionBasis, CommissionStatus } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { listInput } from "../trpc/list-input";

const commissionBasis = z.enum(
	Object.values(CommissionBasis) as [CommissionBasis, ...CommissionBasis[]],
);

const commissionStatus = z.enum(
	Object.values(CommissionStatus) as [CommissionStatus, ...CommissionStatus[]],
);

const currencyCode = z.string().trim().length(3).toUpperCase();

const rate = z.number().min(0).max(1);

export const commissionListInput = listInput.extend({
	status: z.array(commissionStatus).default([]),
	basis: z.array(commissionBasis).default([]),
	userId: z.string().nullable().default(null),
	bookingId: z.string().nullable().default(null),
});

export type CommissionListInput = z.infer<typeof commissionListInput>;

export const commissionByBookingInput = z.object({ bookingId: z.string() });

export const createCommissionInput = z
	.object({
		bookingId: z.string(),
		userId: z.string(),
		basis: commissionBasis,
		rate: rate.nullable().default(null),
		amount: z
			.number()
			.positive("A fixed commission needs an amount.")
			.nullable()
			.default(null),
		currency: currencyCode.nullable().default(null),
		note: z.string().trim().max(2000).nullable().default(null),
	})
	.refine(
		(input) =>
			input.basis !== "FIXED" ||
			(input.amount !== null && input.currency !== null),
		{
			message: "A fixed commission needs an amount and a currency.",
			path: ["amount"],
		},
	)
	.refine((input) => input.basis === "FIXED" || input.rate !== null, {
		message: "A margin or sell commission needs a rate.",
		path: ["rate"],
	});

export type CreateCommissionInput = z.infer<typeof createCommissionInput>;

export const updateCommissionInput = z.object({
	id: z.string(),
	rate: rate.nullable().optional(),
	amount: z.number().positive().nullable().optional(),
	currency: currencyCode.nullable().optional(),
	note: z.string().trim().max(2000).nullable().optional(),
});

export type UpdateCommissionInput = z.infer<typeof updateCommissionInput>;

export const commissionIdInput = z.object({ id: z.string() });

export const commissionBulkInput = bulkIdsInput;

export const commissionRowOutput = z.object({
	id: z.string(),
	bookingId: z.string(),
	bookingFolio: z.string(),
	userId: z.string(),
	userName: z.string(),
	basis: commissionBasis,
	rate: z.number().nullable(),
	basisBaseAmount: z.number().nullable(),
	amount: z.number().nullable(),
	currency: z.string().nullable(),
	amountBase: z.number().nullable(),
	baseCurrency: z.string().nullable(),
	status: commissionStatus,
	approvedAt: z.string().nullable(),
	paidAt: z.string().nullable(),
	note: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type CommissionRow = z.infer<typeof commissionRowOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const commissionListOutput = z.object({
	rows: z.array(commissionRowOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
	missingRate: z.number(),
});

export const commissionByBookingOutput = z.object({
	rows: z.array(commissionRowOutput),
	bookingMarginBase: z.number().nullable(),
	baseCurrency: z.string().nullable(),
});

export const commissionSummaryOutput = z.object({
	id: z.string(),
	status: commissionStatus,
});

export const commissionDeleteOutput = z.object({ id: z.string() });

export const commissionBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const advisorReportOutput = z.object({
	baseCurrency: z.string().nullable(),
	rows: z.array(
		z.object({
			userId: z.string(),
			userName: z.string(),
			commissions: z.number(),
			commissionBase: z.number(),
			missingRate: z.number(),
			bookings: z.number(),
			sellBase: z.number().nullable(),
			marginBase: z.number().nullable(),
		}),
	),
});

export const supplierReportOutput = z.object({
	baseCurrency: z.string().nullable(),
	rows: z.array(
		z.object({
			supplierId: z.string(),
			supplierName: z.string(),
			items: z.number(),
			costBase: z.number(),
			sellBase: z.number(),
			defaultRate: z.number().nullable(),
		}),
	),
});
