import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import { ConversionService } from "../src/currency/conversion.service";
import { PaymentsService } from "../src/payments/payments.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const conversion = new ConversionService(db);
const payments = new PaymentsService(db, conversion);

let a: SeededAgency;
let bookingId: string;

const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
	a = await seedAgency("pay");
	const booking = await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}`,
			customerId: a.customerId,
			status: "DRAFT",
			currency: "USD",
		},
		select: { id: true },
	});
	bookingId = booking.id;
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await db.$disconnect();
});

describe("payments — OVERDUE is derived, never stored", () => {
	it("a past due date reads OVERDUE while the stored status stays SCHEDULED", async () => {
		const added = await payments.add(a.agencyId, "owner", {
			bookingId,
			dueDate: new Date(Date.now() - 3 * DAY).toISOString(),
			amount: 500,
			currency: "USD",
			method: null,
			reference: null,
		});
		expect(added.status).toBe("OVERDUE");

		const stored = await db.payment.findFirstOrThrow({
			where: { id: added.id },
			select: { status: true },
		});
		expect(stored.status).toBe("SCHEDULED");
	});

	it("a future due date reads SCHEDULED", async () => {
		const added = await payments.add(a.agencyId, "owner", {
			bookingId,
			dueDate: new Date(Date.now() + 10 * DAY).toISOString(),
			amount: 250,
			currency: "USD",
			method: null,
			reference: null,
		});
		expect(added.status).toBe("SCHEDULED");
	});

	it("recording a payment turns it PAID and out of the overdue bucket", async () => {
		const added = await payments.add(a.agencyId, "owner", {
			bookingId,
			dueDate: new Date(Date.now() - DAY).toISOString(),
			amount: 100,
			currency: "USD",
			method: null,
			reference: null,
		});
		expect(added.status).toBe("OVERDUE");

		const recorded = await payments.record(a.agencyId, "owner", {
			id: added.id,
			paidAt: null,
			method: "CASH",
			reference: "receipt-1",
		});
		expect(recorded.status).toBe("PAID");
	});

	it("list totals split scheduled, overdue and paid by base amount", async () => {
		const result = await payments.list(a.agencyId, {
			bookingId,
			kind: "all",
			status: [],
		});

		expect(result.totals.baseCurrency).toBe("USD");
		expect(result.totals.overdueBase).toBe(500);
		expect(result.totals.scheduledBase).toBe(250);
		expect(result.totals.paidBase).toBe(100);
	});

	it("the status filter understands the derived OVERDUE value", async () => {
		const overdue = await payments.list(a.agencyId, {
			bookingId,
			kind: "all",
			status: ["OVERDUE"],
		});
		expect(overdue.rows).toHaveLength(1);
		expect(overdue.rows[0]?.status).toBe("OVERDUE");
	});

	it("an agent may not change payments", async () => {
		await expect(
			payments.add(a.agencyId, "agent", {
				bookingId,
				dueDate: new Date().toISOString(),
				amount: 1,
				currency: "USD",
				method: null,
				reference: null,
			}),
		).rejects.toThrow();
	});
});
