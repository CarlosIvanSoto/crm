import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db, Prisma } from "@travel/db";
import { RemindersController } from "../src/activities/reminders.controller";
import {
	RemindersService,
	type SweepResult,
} from "../src/activities/reminders.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const reminders = new RemindersService(db);

const DAY = 24 * 60 * 60 * 1000;

let a: SeededAgency;
let b: SeededAgency;
let bookingA: string;
let bookingB: string;

async function overduePayment(agencyId: string, bookingId: string) {
	return db.payment.create({
		data: {
			agencyId,
			bookingId,
			dueDate: new Date(Date.now() - 5 * DAY),
			amount: new Prisma.Decimal("100.00"),
			currency: "USD",
			status: "SCHEDULED",
		},
	});
}

beforeAll(async () => {
	a = await seedAgency("rem-a");
	b = await seedAgency("rem-b");

	const first = await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}`,
			customerId: a.customerId,
			ownerId: a.ownerUserId,
			status: "CONFIRMED",
			currency: "USD",
			travelStartDate: new Date(Date.now() + 3 * DAY),
		},
		select: { id: true },
	});
	bookingA = first.id;

	const second = await db.booking.create({
		data: {
			agencyId: b.agencyId,
			folio: `EXP-${b.agencyId}`,
			customerId: b.customerId,
			ownerId: b.ownerUserId,
			status: "CONFIRMED",
			currency: "USD",
			travelStartDate: new Date(Date.now() + 200 * DAY),
		},
		select: { id: true },
	});
	bookingB = second.id;

	await overduePayment(a.agencyId, bookingA);
});

afterEach(async () => {
	await db.activity.deleteMany({
		where: { agencyId: { in: [a.agencyId, b.agencyId] } },
	});
});

afterAll(async () => {
	await db.payment.deleteMany({
		where: { agencyId: { in: [a.agencyId, b.agencyId] } },
	});
	await db.booking.deleteMany({
		where: { agencyId: { in: [a.agencyId, b.agencyId] } },
	});
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

describe("reminder sweep", () => {
	it("keeps one agency's reminders out of another's", async () => {
		await reminders.sweepAllAgencies();

		const rowsA = await db.activity.findMany({
			where: { agencyId: a.agencyId, sourceKey: { not: null } },
			select: { sourceKey: true },
		});
		const rowsB = await db.activity.findMany({
			where: { agencyId: b.agencyId, sourceKey: { not: null } },
			select: { sourceKey: true, bookingId: true },
		});

		expect(rowsA.map((row) => row.sourceKey)).toContain(
			`departure:${bookingA}`,
		);
		expect(
			rowsA.some((row) => row.sourceKey?.startsWith("payment-overdue:")),
		).toBe(true);
		expect(rowsB.every((row) => row.bookingId === bookingB)).toBe(true);
		expect(rowsB.map((row) => row.sourceKey)).not.toContain(
			`departure:${bookingA}`,
		);
	});

	it("creates the payment and departure rows once across two runs", async () => {
		const first = await reminders.sweepAllAgencies();
		const second = await reminders.sweepAllAgencies();

		expect(first.created).toBeGreaterThan(0);
		expect(second.created).toBe(0);

		const rows = await db.activity.count({
			where: { agencyId: a.agencyId, sourceKey: { not: null } },
		});
		expect(rows).toBe(2);
	});

	it("finishes with mailed 0 when Resend is not configured", async () => {
		const wasKey = process.env.TRAVEL_RESEND_API_KEY;
		delete process.env.TRAVEL_RESEND_API_KEY;

		await db.activity.create({
			data: {
				agencyId: a.agencyId,
				type: "TASK",
				subject: "Late human task",
				bookingId: bookingA,
				createdById: a.ownerUserId,
				assignedToId: a.ownerUserId,
				dueAt: new Date(Date.now() - 2 * DAY),
			},
		});

		const result = await reminders.sweepAllAgencies();

		expect(result.reminded).toBeGreaterThan(0);
		expect(result.mailed).toBe(0);

		if (wasKey === undefined) delete process.env.TRAVEL_RESEND_API_KEY;
		else process.env.TRAVEL_RESEND_API_KEY = wasKey;
	});

	it("refuses to run with no secret and never touches the sweep", async () => {
		let ran = false;
		const sweep = {
			sweepAllAgencies: async () => {
				ran = true;
				return {} as SweepResult;
			},
		} as unknown as RemindersService;
		const config = {
			get: () => undefined,
		} as unknown as ConstructorParameters<typeof RemindersController>[1];

		const controller = new RemindersController(sweep, config);

		await expect(
			controller.remindersViaPost("Bearer whatever"),
		).rejects.toThrow(/not configured/i);
		expect(ran).toBe(false);
	});

	it("rejects a wrong authorization header", async () => {
		const sweep = {
			sweepAllAgencies: async () => ({}) as SweepResult,
		} as unknown as RemindersService;
		const config = {
			get: () => "the-real-secret-value",
		} as unknown as ConstructorParameters<typeof RemindersController>[1];

		const controller = new RemindersController(sweep, config);

		await expect(controller.remindersViaPost("Bearer wrong")).rejects.toThrow();
	});

	it("does not re-warn a task reminded inside the resend window", async () => {
		const recent = await db.activity.create({
			data: {
				agencyId: a.agencyId,
				type: "TASK",
				subject: "Warned three days ago",
				bookingId: bookingA,
				createdById: a.ownerUserId,
				assignedToId: a.ownerUserId,
				dueAt: new Date(Date.now() - 10 * DAY),
				reminderSentAt: new Date(Date.now() - 3 * DAY),
			},
		});
		const old = await db.activity.create({
			data: {
				agencyId: a.agencyId,
				type: "TASK",
				subject: "Warned eight days ago",
				bookingId: bookingA,
				createdById: a.ownerUserId,
				assignedToId: a.ownerUserId,
				dueAt: new Date(Date.now() - 10 * DAY),
				reminderSentAt: new Date(Date.now() - 8 * DAY),
			},
		});

		await reminders.sweepAllAgencies();

		const recentAfter = await db.activity.findFirstOrThrow({
			where: { id: recent.id },
			select: { reminderSentAt: true },
		});
		const oldAfter = await db.activity.findFirstOrThrow({
			where: { id: old.id },
			select: { reminderSentAt: true },
		});

		expect(recentAfter.reminderSentAt?.getTime()).toBe(
			recent.reminderSentAt?.getTime(),
		);
		expect(oldAfter.reminderSentAt?.getTime()).toBeGreaterThan(
			old.reminderSentAt?.getTime() ?? 0,
		);
	});

	it("writes a task when a traveler's document expires before departure", async () => {
		const traveler = await db.traveler.create({
			data: {
				agencyId: a.agencyId,
				firstName: "Pat",
				lastName: "Traveler",
				documentExpiresAt: new Date(Date.now() + 15 * DAY),
			},
		});
		await db.bookingTraveler.create({
			data: {
				agencyId: a.agencyId,
				bookingId: bookingA,
				travelerId: traveler.id,
			},
		});

		await reminders.sweepAllAgencies();

		const expiresAt = traveler.documentExpiresAt as Date;
		const sourceKey = `document-expiry:${traveler.id}:${expiresAt.toISOString().slice(0, 10)}`;
		const task = await db.activity.findFirst({
			where: { agencyId: a.agencyId, sourceKey },
		});

		expect(task).not.toBeNull();
		expect(task?.assignedToId).toBe(a.ownerUserId);
		expect(task?.bookingId).toBe(bookingA);

		await db.bookingTraveler.deleteMany({ where: { travelerId: traveler.id } });
		await db.traveler.delete({ where: { id: traveler.id } });
	});

	it("does not duplicate the document-expiry task on a second run", async () => {
		const traveler = await db.traveler.create({
			data: {
				agencyId: a.agencyId,
				firstName: "Sam",
				lastName: "Traveler",
				documentExpiresAt: new Date(Date.now() + 20 * DAY),
			},
		});
		await db.bookingTraveler.create({
			data: {
				agencyId: a.agencyId,
				bookingId: bookingA,
				travelerId: traveler.id,
			},
		});

		const first = await reminders.sweepAllAgencies();
		const second = await reminders.sweepAllAgencies();

		expect(first.created).toBeGreaterThan(0);
		expect(second.created).toBe(0);

		const expiresAt = traveler.documentExpiresAt as Date;
		const sourceKey = `document-expiry:${traveler.id}:${expiresAt.toISOString().slice(0, 10)}`;
		const rows = await db.activity.count({
			where: { agencyId: a.agencyId, sourceKey },
		});
		expect(rows).toBe(1);

		await db.bookingTraveler.deleteMany({ where: { travelerId: traveler.id } });
		await db.traveler.delete({ where: { id: traveler.id } });
	});
});
