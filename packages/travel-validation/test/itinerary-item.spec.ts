import { describe, expect, it } from "bun:test";
import {
	InvalidItineraryDetails,
	parseItineraryDetails,
	readItineraryDetails,
	UNREADABLE_DETAILS,
} from "../src/itinerary-item";

describe("parseItineraryDetails", () => {
	it("takes a real flight", () => {
		const details = parseItineraryDetails({
			type: "FLIGHT",
			airline: "Aeromexico",
			flightNumber: "AM12",
			cabin: "ECONOMY",
			departureAirport: "mex",
			arrivalAirport: "mad",
			baggage: null,
		});

		expect(details.type).toBe("FLIGHT");
		if (details.type === "FLIGHT") {
			expect(details.departureAirport).toBe("MEX");
		}
	});

	it("takes a real hotel", () => {
		const details = parseItineraryDetails({
			type: "HOTEL",
			hotelName: "Riu Palace",
			roomType: "Junior Suite",
			mealPlan: "ALL_INCLUSIVE",
			nights: 5,
		});

		expect(details.type).toBe("HOTEL");
	});

	it("names the field that failed", () => {
		try {
			parseItineraryDetails({
				type: "FLIGHT",
				airline: "",
				flightNumber: "AM12",
				cabin: "ECONOMY",
				departureAirport: "MEX",
				arrivalAirport: "MAD",
				baggage: null,
			});
			throw new Error("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(InvalidItineraryDetails);
			expect((error as Error).message).toContain("airline");
		}
	});

	it("refuses an unknown type", () => {
		expect(() => parseItineraryDetails({ type: "SPACESHIP" })).toThrow(
			InvalidItineraryDetails,
		);
	});
});

describe("readItineraryDetails", () => {
	it("returns the parsed value when it is readable", () => {
		const details = readItineraryDetails({
			type: "OTHER",
			label: "Traslado en lancha",
			notes: null,
		});

		expect(details).toEqual({
			type: "OTHER",
			label: "Traslado en lancha",
			notes: null,
		});
	});

	it("degrades to a sentinel when the row is unreadable", () => {
		expect(readItineraryDetails({ type: "FLIGHT" })).toBe(UNREADABLE_DETAILS);
		expect(readItineraryDetails(null)).toBe(UNREADABLE_DETAILS);
	});
});
