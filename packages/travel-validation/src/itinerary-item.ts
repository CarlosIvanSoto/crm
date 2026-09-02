import { ItineraryItemType } from "@travel/db/enums";
import { z } from "zod";

const iataCode = z
	.string()
	.trim()
	.toUpperCase()
	.length(3)
	.regex(/^[A-Z]{3}$/, "must be a three-letter IATA code");

export const itineraryDetails = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(ItineraryItemType.FLIGHT),
		airline: z.string().trim().min(1).max(120),
		flightNumber: z.string().trim().min(1).max(12),
		cabin: z.enum(["ECONOMY", "PREMIUM", "BUSINESS", "FIRST"]),
		departureAirport: iataCode,
		arrivalAirport: iataCode,
		baggage: z.string().trim().max(200).nullable(),
	}),
	z.object({
		type: z.literal(ItineraryItemType.HOTEL),
		hotelName: z.string().trim().min(1).max(200),
		roomType: z.string().trim().max(120),
		mealPlan: z.enum([
			"ROOM_ONLY",
			"BREAKFAST",
			"HALF",
			"FULL",
			"ALL_INCLUSIVE",
		]),
		nights: z.number().int().min(1).max(365),
	}),
	z.object({
		type: z.literal(ItineraryItemType.TRANSFER),
		mode: z.enum(["PRIVATE", "SHARED", "SHUTTLE"]),
		vehicle: z.string().trim().max(120).nullable(),
		pickup: z.string().trim().min(1).max(200),
		dropoff: z.string().trim().min(1).max(200),
	}),
	z.object({
		type: z.literal(ItineraryItemType.TOUR),
		tourName: z.string().trim().min(1).max(200),
		durationHours: z.number().min(0.5).max(720).nullable(),
		guideLanguage: z.string().trim().max(60).nullable(),
		isPrivate: z.boolean(),
	}),
	z.object({
		type: z.literal(ItineraryItemType.CRUISE),
		shipName: z.string().trim().min(1).max(200),
		cabinCategory: z.enum(["INTERIOR", "OCEAN_VIEW", "BALCONY", "SUITE"]),
		nights: z.number().int().min(1).max(365),
	}),
	z.object({
		type: z.literal(ItineraryItemType.INSURANCE),
		planName: z.string().trim().min(1).max(200),
		coverage: z.string().trim().min(1).max(200),
		policyNumber: z.string().trim().max(60).nullable(),
	}),
	z.object({
		type: z.literal(ItineraryItemType.CAR_RENTAL),
		company: z.string().trim().min(1).max(120),
		carClass: z.string().trim().min(1).max(120),
		pickupLocation: z.string().trim().min(1).max(200),
		dropoffLocation: z.string().trim().min(1).max(200),
		transmission: z.enum(["AUTOMATIC", "MANUAL"]),
	}),
	z.object({
		type: z.literal(ItineraryItemType.PACKAGE),
		packageName: z.string().trim().min(1).max(200),
		inclusions: z.string().trim().max(1000),
	}),
	z.object({
		type: z.literal(ItineraryItemType.OTHER),
		label: z.string().trim().min(1).max(200),
		notes: z.string().trim().max(1000).nullable(),
	}),
]);

export type ItineraryDetails = z.infer<typeof itineraryDetails>;

export class InvalidItineraryDetails extends Error {
	constructor(readonly issues: string) {
		super(`The itinerary item details are unreadable: ${issues}`);
		this.name = "InvalidItineraryDetails";
	}
}

export function parseItineraryDetails(value: unknown): ItineraryDetails {
	const parsed = itineraryDetails.safeParse(value);
	if (parsed.success) return parsed.data;

	throw new InvalidItineraryDetails(
		parsed.error.issues
			.map((issue) => `${issue.path.join(".") || "details"} ${issue.message}`)
			.join("; "),
	);
}

export const UNREADABLE_DETAILS: ItineraryDetails = {
	type: ItineraryItemType.OTHER,
	label: "Detalle no legible",
	notes: null,
};

export function readItineraryDetails(value: unknown): ItineraryDetails {
	const parsed = itineraryDetails.safeParse(value);
	return parsed.success ? parsed.data : UNREADABLE_DETAILS;
}
