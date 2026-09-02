import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { db } from "@travel/db";
import { BookingsService } from "../src/bookings/bookings.service";
import { ConversionService } from "../src/currency/conversion.service";
import { CustomersService } from "../src/customers/customers.service";
import { QuotesService } from "../src/quotes/quotes.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const conversion = new ConversionService(db);
const customers = new CustomersService(db);
const quotes = new QuotesService(db, conversion);
const bookings = new BookingsService(db, conversion);

let a: SeededAgency;
let b: SeededAgency;

beforeAll(async () => {
	a = await seedAgency("a");
	b = await seedAgency("b");
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

describe("agency isolation", () => {
	it("customers.list returns only the caller's rows", async () => {
		const listA = await customers.list(a.agencyId, {
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 25,
			type: [],
			owner: [],
			archived: false,
		});

		expect(listA.rows).toHaveLength(1);
		expect(listA.rows[0]?.id).toBe(a.customerId);
	});

	it("customers.byId cannot read another agency's row", async () => {
		const read = customers.byId(a.agencyId, b.customerId);
		await expect(read).rejects.toBeInstanceOf(NotFoundException);
	});

	it("quotes.create refuses a customer from another agency", async () => {
		const attempt = quotes.create(a.agencyId, {
			customerId: b.customerId,
			ownerId: null,
			destination: null,
			currency: "USD",
			validUntil: null,
			travelStartDate: null,
			travelEndDate: null,
			paxAdults: 1,
			paxChildren: 0,
			paxInfants: 0,
			notes: null,
			terms: null,
		});

		await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
	});

	it("bookings.byId cannot read another agency's booking", async () => {
		const booking = await bookings.create(b.agencyId, {
			customerId: b.customerId,
			ownerId: null,
			destination: null,
			currency: "USD",
			travelStartDate: null,
			travelEndDate: null,
		});

		const read = bookings.byId(a.agencyId, booking.id);
		await expect(read).rejects.toBeInstanceOf(NotFoundException);

		const own = await bookings.byId(b.agencyId, booking.id);
		expect(own.id).toBe(booking.id);
	});
});
