import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, Prisma } from "@travel/db";
import { ConversionService } from "../src/currency/conversion.service";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const conversion = new ConversionService(db);
const dashboard = new DashboardService(db, conversion);

const DAY = 24 * 60 * 60 * 1000;

let a: SeededAgency;

beforeAll(async () => {
	a = await seedAgency("dash");

	await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}-1`,
			customerId: a.customerId,
			ownerId: a.ownerUserId,
			status: "CONFIRMED",
			currency: "USD",
			sellTotalBase: new Prisma.Decimal("1000.0000"),
			costTotalBase: new Prisma.Decimal("600.0000"),
			baseCurrency: "USD",
			travelStartDate: new Date(Date.now() + 10 * DAY),
		},
	});

	const overdueBooking = await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}-2`,
			customerId: a.customerId,
			ownerId: a.ownerUserId,
			status: "CONFIRMED",
			currency: "USD",
			travelStartDate: new Date(Date.now() + 200 * DAY),
		},
		select: { id: true },
	});

	await db.payment.create({
		data: {
			agencyId: a.agencyId,
			bookingId: overdueBooking.id,
			dueDate: new Date(Date.now() - 5 * DAY),
			amount: new Prisma.Decimal("250.00"),
			currency: "USD",
			baseAmount: new Prisma.Decimal("250.0000"),
			baseCurrency: "USD",
			status: "SCHEDULED",
		},
	});
});

afterAll(async () => {
	await db.payment.deleteMany({ where: { agencyId: a.agencyId } });
	await dropAgency(a.agencyId);
	await db.$disconnect();
});

describe("dashboard summary", () => {
	it("sums this month's bookings in base currency", async () => {
		const result = await dashboard.summary(a.agencyId, "owner", a.ownerUserId, {
			scope: "everyone",
		});

		expect(result.baseCurrency).toBe("USD");
		expect(result.month.soldBase).toBe(1000);
		expect(result.month.costBase).toBe(600);
		expect(result.month.marginBase).toBe(400);
		expect(result.month.bookings).toBe(2);
	});

	it("returns marginBase null for a role that cannot see margins", async () => {
		const result = await dashboard.summary(a.agencyId, "agent", a.ownerUserId, {
			scope: "everyone",
		});

		expect(result.month.marginBase).toBeNull();
		expect(result.month.soldBase).toBe(1000);
	});

	it("adds up the overdue charges", async () => {
		const result = await dashboard.summary(a.agencyId, "owner", a.ownerUserId, {
			scope: "everyone",
		});

		expect(result.overdue.count).toBe(1);
		expect(result.overdue.amountBase).toBe(250);
		expect(result.overdue.missingRate).toBe(0);
	});

	it("lists departures inside the 30-day window", async () => {
		const result = await dashboard.summary(a.agencyId, "owner", a.ownerUserId, {
			scope: "everyone",
		});

		expect(result.departures.windowDays).toBe(30);
		expect(result.departures.count).toBe(1);
		expect(result.departures.items[0]?.folio).toBe(`EXP-${a.agencyId}-1`);
	});
});
