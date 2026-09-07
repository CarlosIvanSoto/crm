import type { SeedAgencySpec } from "./config";
import { pick, type Rng } from "./random";

export interface SeededUser {
	id: string;
	key: string;
	name: string;
	email: string;
	role: string;
}

export interface SeededSupplier {
	id: string;
	kind: string;
	name: string;
	currency: string;
	archived: boolean;
}

export interface SeededCustomer {
	id: string;
	type: string;
	name: string;
	email: string;
	ownerId: string | null;
	archived: boolean;
}

export interface SeededTraveler {
	id: string;
	customerId: string | null;
	name: string;
}

export interface SeededQuoteOption {
	id: string;
	label: string;
	sellTotalBase: string | null;
	costTotalBase: string | null;
}

export interface SeededQuote {
	id: string;
	folio: string;
	status: string;
	ownerId: string | null;
	customerId: string;
	currency: string;
	validUntil: Date | null;
	sentAt: Date | null;
	options: SeededQuoteOption[];
}

export interface SeededBookingItem {
	id: string;
	supplierId: string | null;
	sellAmount: string | null;
	sellCurrency: string | null;
}

export interface SeededBooking {
	id: string;
	folio: string;
	status: string;
	ownerId: string | null;
	customerId: string;
	currency: string;
	baseCurrency: string;
	sellTotalBase: string | null;
	costTotalBase: string | null;
	travelStartDate: Date | null;
	items: SeededBookingItem[];
	travelerIds: string[];
	fromQuoteId: string | null;
}

export interface AgencyBag {
	spec: SeedAgencySpec;
	agencyId: string;
	base: string;
	users: SeededUser[];
	suppliers: SeededSupplier[];
	customers: SeededCustomer[];
	travelers: SeededTraveler[];
	quotes: SeededQuote[];
	bookings: SeededBooking[];
	quoteSeq: number;
	bookingSeq: number;
	shareLinks: string[];
}

export function userByKey(bag: AgencyBag, key: string): SeededUser {
	const found = bag.users.find((user) => user.key === key);
	if (!found) {
		throw new Error(`No seeded user with key ${key} in ${bag.spec.slug}.`);
	}
	return found;
}

export function usersByRole(bag: AgencyBag, role: string): SeededUser[] {
	return bag.users.filter((user) => user.role === role);
}

export function agents(bag: AgencyBag): SeededUser[] {
	return usersByRole(bag, "agent");
}

export function randomOwner(bag: AgencyBag, rng: Rng): string {
	const pool = bag.users.filter((user) => user.role !== "accountant");
	return pick(rng, pool).id;
}
