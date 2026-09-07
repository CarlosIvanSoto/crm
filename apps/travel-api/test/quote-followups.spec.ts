import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import { QuoteFollowupController } from "../src/agent/quote-followup.controller";
import {
	type QuoteFollowupResult,
	QuoteFollowupService,
} from "../src/agent/quote-followup.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const followups = new QuoteFollowupService(db);

const DAY = 24 * 60 * 60 * 1000;

let a: SeededAgency;
let b: SeededAgency;

async function sentQuote(
	agencyId: string,
	customerId: string,
	ownerId: string | null,
	sentDaysAgo: number,
) {
	return db.quote.create({
		data: {
			agencyId,
			folio: `COT-${agencyId}-${Math.random().toString(36).slice(2, 8)}`,
			customerId,
			ownerId,
			status: "SENT",
			sentAt: new Date(Date.now() - sentDaysAgo * DAY),
		},
	});
}

beforeAll(async () => {
	a = await seedAgency("qf-a");
	b = await seedAgency("qf-b");
});

afterEach(async () => {
	await db.agentTask.deleteMany({
		where: { agencyId: { in: [a.agencyId, b.agencyId] } },
	});
	await db.activity.deleteMany({
		where: { agencyId: { in: [a.agencyId, b.agencyId] } },
	});
	await db.quote.deleteMany({
		where: { agencyId: { in: [a.agencyId, b.agencyId] } },
	});
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

describe("quote follow-up sweep", () => {
	it("writes a task for a quote sent five days ago with no owner action yet", async () => {
		const quote = await sentQuote(a.agencyId, a.customerId, a.ownerUserId, 5);

		const result = await followups.sweepAllAgencies();

		expect(result.created).toBeGreaterThan(0);

		const task = await db.agentTask.findFirst({
			where: { quoteId: quote.id, kind: "quote-followup" },
		});
		expect(task).not.toBeNull();
		expect(task?.reason).toContain(quote.folio);
	});

	it("does not write anything for a quote sent one day ago", async () => {
		const quote = await sentQuote(a.agencyId, a.customerId, a.ownerUserId, 1);

		await followups.sweepAllAgencies();

		const task = await db.agentTask.findFirst({
			where: { quoteId: quote.id, kind: "quote-followup" },
		});
		expect(task).toBeNull();
	});

	it("does not duplicate a row while one is still open", async () => {
		const quote = await sentQuote(a.agencyId, a.customerId, a.ownerUserId, 5);

		const first = await followups.sweepAllAgencies();
		const second = await followups.sweepAllAgencies();

		expect(first.created).toBeGreaterThan(0);

		const tasks = await db.agentTask.findMany({
			where: { quoteId: quote.id, kind: "quote-followup" },
		});
		expect(tasks.length).toBe(1);
		expect(second.created).toBeLessThanOrEqual(first.created);
	});

	it("does not re-file within the reminder interval", async () => {
		const quote = await sentQuote(a.agencyId, a.customerId, a.ownerUserId, 10);

		await db.activity.create({
			data: {
				agencyId: a.agencyId,
				type: "TASK",
				subject: "Prior follow-up",
				quoteId: quote.id,
				createdById: a.ownerUserId,
				assignedToId: a.ownerUserId,
				dueAt: new Date(),
				sourceKey: `quote-followup:${quote.id}:${new Date(Date.now() - 2 * DAY)
					.toISOString()
					.slice(0, 10)}`,
			},
		});

		await followups.sweepAllAgencies();

		const task = await db.agentTask.findFirst({
			where: { quoteId: quote.id, kind: "quote-followup" },
		});
		expect(task).toBeNull();
	});

	it("never considers an ACCEPTED, DECLINED or archived quote", async () => {
		const accepted = await sentQuote(
			a.agencyId,
			a.customerId,
			a.ownerUserId,
			10,
		);
		await db.quote.update({
			where: { id: accepted.id },
			data: { status: "ACCEPTED" },
		});

		const declined = await sentQuote(
			a.agencyId,
			a.customerId,
			a.ownerUserId,
			10,
		);
		await db.quote.update({
			where: { id: declined.id },
			data: { status: "DECLINED" },
		});

		const archived = await sentQuote(
			a.agencyId,
			a.customerId,
			a.ownerUserId,
			10,
		);
		await db.quote.update({
			where: { id: archived.id },
			data: { archivedAt: new Date() },
		});

		await followups.sweepAllAgencies();

		const tasks = await db.agentTask.findMany({
			where: {
				quoteId: { in: [accepted.id, declined.id, archived.id] },
				kind: "quote-followup",
			},
		});
		expect(tasks.length).toBe(0);
	});

	it("skips a quote with no owner instead of throwing", async () => {
		const quote = await sentQuote(a.agencyId, a.customerId, null, 10);

		await expect(followups.sweepAllAgencies()).resolves.toBeDefined();

		const task = await db.agentTask.findFirst({
			where: { quoteId: quote.id, kind: "quote-followup" },
		});
		expect(task).toBeNull();
	});

	it("keeps one agency's sweep out of another's", async () => {
		const quoteA = await sentQuote(a.agencyId, a.customerId, a.ownerUserId, 5);
		const quoteB = await sentQuote(b.agencyId, b.customerId, b.ownerUserId, 5);

		await followups.sweepAllAgencies();

		const rowsA = await db.agentTask.findMany({
			where: { quoteId: quoteA.id },
		});
		const rowsB = await db.agentTask.findMany({
			where: { quoteId: quoteB.id },
		});

		expect(rowsA.every((row) => row.agencyId === a.agencyId)).toBe(true);
		expect(rowsB.every((row) => row.agencyId === b.agencyId)).toBe(true);
	});

	it("refuses to run with no secret and never touches the sweep", async () => {
		let ran = false;
		const sweep = {
			sweepAllAgencies: async () => {
				ran = true;
				return {} as QuoteFollowupResult;
			},
		} as unknown as QuoteFollowupService;
		const config = {
			get: () => undefined,
		} as unknown as ConstructorParameters<typeof QuoteFollowupController>[1];

		const controller = new QuoteFollowupController(sweep, config);

		await expect(
			controller.quoteFollowupsViaPost("Bearer whatever"),
		).rejects.toThrow(/not configured/i);
		expect(ran).toBe(false);
	});

	it("rejects a wrong authorization header", async () => {
		const sweep = {
			sweepAllAgencies: async () => ({}) as QuoteFollowupResult,
		} as unknown as QuoteFollowupService;
		const config = {
			get: () => "the-real-secret-value",
		} as unknown as ConstructorParameters<typeof QuoteFollowupController>[1];

		const controller = new QuoteFollowupController(sweep, config);

		await expect(
			controller.quoteFollowupsViaPost("Bearer wrong"),
		).rejects.toThrow();
	});
});
