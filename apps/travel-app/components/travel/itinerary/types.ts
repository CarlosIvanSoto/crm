import {
	type ItineraryDetails,
	readItineraryDetails,
} from "@travel/validation/itinerary-item";

export type ItineraryItemType = ItineraryDetails["type"];

export type ItineraryStatus =
	| "QUOTED"
	| "REQUESTED"
	| "CONFIRMED"
	| "CANCELLED";

export type ItineraryDraft = {
	key: string;
	type: ItineraryItemType;
	supplierId: string | null;
	confirmationCode: string | null;
	status: ItineraryStatus;
	startsAt: string | null;
	endsAt: string | null;
	startLocation: string | null;
	endLocation: string | null;
	description: string | null;
	paxCount: number;
	costAmount: number | null;
	costCurrency: string | null;
	sellAmount: number | null;
	sellCurrency: string | null;
	details: ItineraryDetails;
};

export type ItineraryItemInput = Omit<ItineraryDraft, "key"> & {
	position: number;
};

export const ITEM_TYPES: { value: ItineraryItemType; label: string }[] = [
	{ value: "FLIGHT", label: "Flight" },
	{ value: "HOTEL", label: "Hotel" },
	{ value: "TRANSFER", label: "Transfer" },
	{ value: "TOUR", label: "Tour" },
	{ value: "CRUISE", label: "Cruise" },
	{ value: "INSURANCE", label: "Insurance" },
	{ value: "CAR_RENTAL", label: "Car rental" },
	{ value: "PACKAGE", label: "Package" },
	{ value: "OTHER", label: "Other" },
];

export const ITEM_STATUSES: { value: ItineraryStatus; label: string }[] = [
	{ value: "QUOTED", label: "Quoted" },
	{ value: "REQUESTED", label: "Requested" },
	{ value: "CONFIRMED", label: "Confirmed" },
	{ value: "CANCELLED", label: "Cancelled" },
];

export function itemTypeLabel(type: string): string {
	return ITEM_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export function emptyDetails(type: ItineraryItemType): ItineraryDetails {
	switch (type) {
		case "FLIGHT":
			return {
				type: "FLIGHT",
				airline: "",
				flightNumber: "",
				cabin: "ECONOMY",
				departureAirport: "",
				arrivalAirport: "",
				baggage: null,
			};
		case "HOTEL":
			return {
				type: "HOTEL",
				hotelName: "",
				roomType: "",
				mealPlan: "ROOM_ONLY",
				nights: 1,
			};
		case "TRANSFER":
			return {
				type: "TRANSFER",
				mode: "PRIVATE",
				vehicle: null,
				pickup: "",
				dropoff: "",
			};
		case "TOUR":
			return {
				type: "TOUR",
				tourName: "",
				durationHours: null,
				guideLanguage: null,
				isPrivate: false,
			};
		case "CRUISE":
			return {
				type: "CRUISE",
				shipName: "",
				cabinCategory: "INTERIOR",
				nights: 1,
			};
		case "INSURANCE":
			return {
				type: "INSURANCE",
				planName: "",
				coverage: "",
				policyNumber: null,
			};
		case "CAR_RENTAL":
			return {
				type: "CAR_RENTAL",
				company: "",
				carClass: "",
				pickupLocation: "",
				dropoffLocation: "",
				transmission: "AUTOMATIC",
			};
		case "PACKAGE":
			return { type: "PACKAGE", packageName: "", inclusions: "" };
		default:
			return { type: "OTHER", label: "", notes: null };
	}
}

let counter = 0;

export function draftKey(): string {
	counter += 1;
	return `item-${Date.now()}-${counter}`;
}

export function newDraft(type: ItineraryItemType = "OTHER"): ItineraryDraft {
	return {
		key: draftKey(),
		type,
		supplierId: null,
		confirmationCode: null,
		status: "QUOTED",
		startsAt: null,
		endsAt: null,
		startLocation: null,
		endLocation: null,
		description: null,
		paxCount: 1,
		costAmount: null,
		costCurrency: null,
		sellAmount: null,
		sellCurrency: null,
		details: emptyDetails(type),
	};
}

type OutputItem = {
	type: string;
	supplierId: string | null;
	confirmationCode?: string | null;
	status: string;
	startsAt: string | null;
	endsAt: string | null;
	description: string | null;
	paxCount: number;
	costAmount: number | null;
	costCurrency: string | null;
	sellAmount: number | null;
	sellCurrency: string | null;
	details?: unknown;
};

function asStatus(value: string): ItineraryStatus {
	return value === "REQUESTED" || value === "CONFIRMED" || value === "CANCELLED"
		? value
		: "QUOTED";
}

export function draftFromOutput(item: OutputItem): ItineraryDraft {
	const details = readItineraryDetails(item.details);
	return {
		key: draftKey(),
		type: details.type,
		supplierId: item.supplierId,
		confirmationCode: item.confirmationCode ?? null,
		status: asStatus(item.status),
		startsAt: item.startsAt,
		endsAt: item.endsAt,
		startLocation: null,
		endLocation: null,
		description: item.description,
		paxCount: item.paxCount,
		costAmount: item.costAmount,
		costCurrency: item.costCurrency,
		sellAmount: item.sellAmount,
		sellCurrency: item.sellCurrency,
		details,
	};
}

export function toItemInput(
	draft: ItineraryDraft,
	position: number,
): ItineraryItemInput {
	return {
		type: draft.type,
		supplierId: draft.supplierId,
		confirmationCode: draft.confirmationCode,
		status: draft.status,
		startsAt: draft.startsAt,
		endsAt: draft.endsAt,
		startLocation: draft.startLocation,
		endLocation: draft.endLocation,
		description: draft.description,
		paxCount: draft.paxCount,
		costAmount: draft.costAmount,
		costCurrency: draft.costCurrency,
		sellAmount: draft.sellAmount,
		sellCurrency: draft.sellCurrency,
		details: draft.details,
		position,
	};
}
