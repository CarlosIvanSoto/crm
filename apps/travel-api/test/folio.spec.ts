import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import { ConversionService } from "../src/currency/conversion.service";
import { QuotesService } from "../src/quotes/quotes.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const conversion = new ConversionService(db);
const quotes = new QuotesService(db, conversion);

let a: SeededAgency;
let b: SeededAgency;

const year = new Date().getFullYear();

beforeAll(async () => {
	a = await seedAgency("folio-a");
	b = await seedAgency("folio-b");
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

function baseInput(customerId: string) {
	return {
		customerId,
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
	};
}

describe("folio counters", () => {
	it("each agency keeps its own sequence", async () => {
		const a1 = await quotes.create(a.agencyId, baseInput(a.customerId));
		const b1 = await quotes.create(b.agencyId, baseInput(b.customerId));
		const a2 = await quotes.create(a.agencyId, baseInput(a.customerId));

		expect(a1.folio).toBe(`COT-${year}-0001`);
		expect(b1.folio).toBe(`COT-${year}-0001`);
		expect(a2.folio).toBe(`COT-${year}-0002`);
	});

	it("never repeats a folio inside one agency", async () => {
		const made = await Promise.all(
			Array.from({ length: 5 }, () =>
				quotes.create(b.agencyId, baseInput(b.customerId)),
			),
		);

		const folios = new Set(made.map((quote) => quote.folio));
		expect(folios.size).toBe(5);
	});
});
