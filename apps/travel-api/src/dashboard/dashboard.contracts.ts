import { BookingStatus } from "@travel/db/enums";
import { z } from "zod";

const DASHBOARD_SCOPES = ["me", "everyone"] as const;

export const dashboardSummaryInput = z.object({
	scope: z.enum(DASHBOARD_SCOPES).default("me"),
});

export type DashboardSummaryInput = z.infer<typeof dashboardSummaryInput>;

const bookingStatus = z.enum(
	Object.values(BookingStatus) as [BookingStatus, ...BookingStatus[]],
);

const departureOutput = z.object({
	id: z.string(),
	folio: z.string(),
	customerName: z.string(),
	destination: z.string().nullable(),
	travelStartDate: z.string(),
	travelers: z.number(),
	status: bookingStatus,
});

export const dashboardSummaryOutput = z.object({
	scope: z.enum(DASHBOARD_SCOPES),
	baseCurrency: z.string(),
	month: z.object({
		soldBase: z.number(),
		costBase: z.number(),
		marginBase: z.number().nullable(),
		bookings: z.number(),
	}),
	overdue: z.object({
		amountBase: z.number(),
		count: z.number(),
		missingRate: z.number(),
	}),
	departures: z.object({
		windowDays: z.number(),
		count: z.number(),
		items: z.array(departureOutput),
	}),
	unconverted: z.object({
		count: z.number(),
		currencies: z.array(z.string()),
	}),
});

export type DashboardSummary = z.infer<typeof dashboardSummaryOutput>;
