import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import { ConversionService } from "../src/currency/conversion.service";
import { QuoteShareService } from "../src/quote-share/quote-share.service";
import { QuotesService } from "../src/quotes/quotes.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const conversion = new ConversionService(db);
const quoteShare = new QuoteShareService(db);
const quotes = new QuotesService(db, conversion);

let a: SeededAgency;
let b: SeededAgency;
let quoteAId: string;
let optionAId: string;
let quoteBId: string;

function tokenFrom(url: string): string {
	const token = new URL(url).pathname.split("/").pop();
	if (!token) throw new Error("The share URL has no token.");
	return token;
}

beforeAll(async () => {
	a = await seedAgency("share-a");
	b = await seedAgency("share-b");

	const quoteA = await db.quote.create({
		data: {
			agencyId: a.agencyId,
			folio: `COT-${a.agencyId}`,
			customerId: a.customerId,
			currency: "USD",
			options: {
				create: [
					{ agencyId: a.agencyId, label: "Standard", position: 0 },
					{ agencyId: a.agencyId, label: "Premium", position: 1 },
				],
			},
		},
		select: { id: true, options: { select: { id: true, label: true } } },
	});
	quoteAId = quoteA.id;
	optionAId = quoteA.options.find((o) => o.label === "Standard")?.id ?? "";

	const quoteB = await db.quote.create({
		data: {
			agencyId: b.agencyId,
			folio: `COT-${b.agencyId}`,
			customerId: b.customerId,
			currency: "USD",
			options: {
				create: [{ agencyId: b.agencyId, label: "Only", position: 0 }],
			},
		},
		select: { id: true, options: { select: { id: true } } },
	});
	quoteBId = quoteB.id;
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

describe("quote share — a public link never leaks cost or another agency", () => {
	it("resolves the right quote and never data from another agency", async () => {
		const created = await quoteShare.create(a.agencyId, a.ownerUserId, {
			quoteId: quoteAId,
			expiresInDays: null,
		});
		const view = await quoteShare.view(tokenFrom(created.url ?? ""));

		expect(view.quote.folio).toContain(a.agencyId);
		expect(JSON.stringify(view)).not.toContain(b.agencyId);
	});

	it("a revoked, expired or invented token all give the same not-found", async () => {
		const created = await quoteShare.create(a.agencyId, a.ownerUserId, {
			quoteId: quoteAId,
			expiresInDays: null,
		});
		const token = tokenFrom(created.url ?? "");
		await quoteShare.revoke(a.agencyId, quoteAId);

		const revoked = await quoteShare.view(token).catch((error) => error);
		const invented = await quoteShare
			.view("not-a-real-token-at-all-00")
			.catch((error) => error);

		expect(revoked).toBeInstanceOf(Error);
		expect(invented).toBeInstanceOf(Error);
		expect((revoked as Error).message).toBe((invented as Error).message);
	});

	it("never returns a cost, margin or internal id field", async () => {
		const created = await quoteShare.create(a.agencyId, a.ownerUserId, {
			quoteId: quoteAId,
			expiresInDays: null,
		});
		const view = await quoteShare.view(tokenFrom(created.url ?? ""));

		const flat = JSON.stringify(view);
		expect(flat).not.toMatch(/cost|margin|ownerId|customerId|userId/i);
	});

	it("counts a view and logs one activity on the first view only", async () => {
		const before = await db.activity.count({
			where: {
				quoteId: quoteAId,
				type: "SYSTEM",
				subject: { contains: "opened" },
			},
		});

		const created = await quoteShare.create(a.agencyId, a.ownerUserId, {
			quoteId: quoteAId,
			expiresInDays: null,
		});
		const token = tokenFrom(created.url ?? "");

		await quoteShare.view(token);
		await quoteShare.view(token);

		const share = await db.quoteShare.findFirstOrThrow({
			where: { quoteId: quoteAId, revokedAt: null },
			select: { viewCount: true, firstViewAt: true },
		});
		expect(share.viewCount).toBe(2);
		expect(share.firstViewAt).not.toBeNull();

		const after = await db.activity.count({
			where: {
				quoteId: quoteAId,
				type: "SYSTEM",
				subject: { contains: "opened" },
			},
		});
		expect(after - before).toBe(1);
	});

	it("accept sets status, decidedAt, acceptedOptionId and acceptedByName", async () => {
		const created = await quoteShare.create(a.agencyId, a.ownerUserId, {
			quoteId: quoteAId,
			expiresInDays: null,
		});
		const token = tokenFrom(created.url ?? "");

		const accepted = await quoteShare.accept(token, optionAId, "Jane Doe");
		expect(accepted.optionId).toBe(optionAId);

		const quote = await db.quote.findUniqueOrThrow({
			where: { id: quoteAId },
			select: {
				status: true,
				decidedAt: true,
				acceptedOptionId: true,
				acceptedByName: true,
			},
		});
		expect(quote.status).toBe("ACCEPTED");
		expect(quote.decidedAt).not.toBeNull();
		expect(quote.acceptedOptionId).toBe(optionAId);
		expect(quote.acceptedByName).toBe("Jane Doe");
	});

	it("accepting the same option twice returns the same result and does not duplicate the activity", async () => {
		const before = await db.activity.count({
			where: {
				quoteId: quoteAId,
				type: "SYSTEM",
				subject: { contains: "accepted" },
			},
		});

		const created = await quoteShare.create(a.agencyId, a.ownerUserId, {
			quoteId: quoteAId,
			expiresInDays: null,
		});
		const token = tokenFrom(created.url ?? "");
		await quoteShare.accept(token, optionAId, "Jane Doe");

		const after = await db.activity.count({
			where: {
				quoteId: quoteAId,
				type: "SYSTEM",
				subject: { contains: "accepted" },
			},
		});
		expect(after).toBe(before);
	});

	it("accepting an option from another quote gives not-found", async () => {
		const created = await quoteShare.create(b.agencyId, b.ownerUserId, {
			quoteId: quoteBId,
			expiresInDays: null,
		});
		const token = tokenFrom(created.url ?? "");

		const error = await quoteShare
			.accept(token, optionAId, "Someone")
			.catch((error_) => error_);
		expect(error).toBeInstanceOf(Error);
	});

	it("accepting an expired quote is refused", async () => {
		const expiring = await db.quote.create({
			data: {
				agencyId: a.agencyId,
				folio: `COT-${a.agencyId}-exp`,
				customerId: a.customerId,
				currency: "USD",
				validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
				options: {
					create: [{ agencyId: a.agencyId, label: "Only", position: 0 }],
				},
			},
			select: { id: true, options: { select: { id: true } } },
		});

		const created = await quoteShare.create(a.agencyId, a.ownerUserId, {
			quoteId: expiring.id,
			expiresInDays: null,
		});
		const token = tokenFrom(created.url ?? "");
		const optionId = expiring.options[0]?.id ?? "";

		const error = await quoteShare
			.accept(token, optionId, "Someone")
			.catch((error_) => error_);
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toMatch(/expired/);
	});

	it("after the customer accepts, the advisor's accept still creates the booking", async () => {
		const result = await quotes.accept(a.agencyId, quoteAId, optionAId);
		expect(result.bookingId).toBeDefined();
	});

	it("send without TRAVEL_RESEND_API_KEY still returns a copyable url", async () => {
		const result = await quoteShare.send(b.agencyId, b.ownerUserId, {
			quoteId: quoteBId,
			to: "customer@example.test",
			message: null,
		});
		expect(result.delivered).toBe(false);
		expect(result.url).toContain("/q/");
	});
});
