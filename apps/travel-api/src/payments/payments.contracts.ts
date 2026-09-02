import { PaymentMethod } from "@travel/db/enums";
import { z } from "zod";

const paymentMethod = z.enum(
	Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]],
);

const currencyCode = z.string().trim().length(3).toUpperCase();

const derivedStatus = z.enum(["SCHEDULED", "OVERDUE", "PAID", "VOID"]);

export const paymentKind = z.enum(["customer", "supplier", "all"]);

export const paymentListInput = z.object({
	bookingId: z.string().optional(),
	kind: paymentKind.default("all"),
	status: z.array(derivedStatus).default([]),
});

export type PaymentListInput = z.infer<typeof paymentListInput>;

export const addPaymentInput = z.object({
	bookingId: z.string(),
	dueDate: z.string().datetime(),
	amount: z.number().positive("A payment needs an amount."),
	currency: currencyCode,
	method: paymentMethod.nullable().default(null),
	reference: z.string().trim().max(120).nullable().default(null),
});

export type AddPaymentInput = z.infer<typeof addPaymentInput>;

export const addPayableInput = addPaymentInput.extend({
	supplierId: z.string(),
	bookingItemId: z.string().nullable().default(null),
});

export type AddPayableInput = z.infer<typeof addPayableInput>;

export const recordPaymentInput = z.object({
	id: z.string(),
	paidAt: z.string().datetime().nullable().default(null),
	method: paymentMethod.nullable().default(null),
	reference: z.string().trim().max(120).nullable().default(null),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentInput>;

export const paymentIdInput = z.object({ id: z.string() });

export const paymentRowOutput = z.object({
	id: z.string(),
	kind: z.enum(["customer", "supplier"]),
	bookingId: z.string(),
	supplierId: z.string().nullable(),
	bookingItemId: z.string().nullable(),
	dueDate: z.string(),
	amount: z.number(),
	currency: z.string(),
	baseAmount: z.number().nullable(),
	baseCurrency: z.string().nullable(),
	status: derivedStatus,
	storedStatus: z.enum(["SCHEDULED", "PAID", "VOID"]),
	method: paymentMethod.nullable(),
	paidAt: z.string().nullable(),
	reference: z.string().nullable(),
	createdAt: z.string(),
});

export type PaymentRow = z.infer<typeof paymentRowOutput>;

export const paymentListOutput = z.object({
	rows: z.array(paymentRowOutput),
	totals: z.object({
		baseCurrency: z.string().nullable(),
		scheduledBase: z.number(),
		overdueBase: z.number(),
		paidBase: z.number(),
		missingRate: z.number(),
	}),
});

export const paymentSummaryOutput = z.object({
	id: z.string(),
	status: derivedStatus,
});

export const paymentDeleteOutput = z.object({ id: z.string() });
