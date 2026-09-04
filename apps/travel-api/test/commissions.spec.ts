import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db, Prisma } from "@travel/db";
import { BookingsService } from "../src/bookings/bookings.service";
import type { CommissionListInput } from "../src/commissions/commissions.contracts";
import { CommissionsService } from "../src/commissions/commissions.service";
import { ConversionService } from "../src/currency/conversion.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const conversion = new ConversionService(db);
const commissions = new CommissionsService(db, conversion);
const bookings = new BookingsService(db, conversion);

const LIST: CommissionListInput = {
	q: "",
	sort: "",
	dir: "asc",
	page: 1,
	pageSize: 25,
	status: [],
	basis: [],
	userId: null,
	bookingId: null,
};

let a: SeededAgency;
let b: SeededAgency;
let agentUserId: string;
let pricedBooking: string;
let unpricedBooking: string;
let bookingB: string;

beforeAll(async () => {
	a = await seedAgency("comm-a");
	b = await seedAgency("comm-b");

	const agent = await db.user.create({
		data: {
			id: `${a.agencyId}-agent`,
			name: "Agent",
			email: `agent.${a.agencyId}@example.test`,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
	agentUserId = agent.id;
	await db.member.create({
		data: {
			id: `${a.agencyId}-agent-member`,
			organizationId: a.agencyId,
			userId: agentUserId,
			role: "agent",
			createdAt: new Date(),
		},
	});

	const priced = await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}-p`,
			customerId: a.customerId,
			ownerId: a.ownerUserId,
			status: "CONFIRMED",
			currency: "USD",
			sellTotalBase: new Prisma.Decimal("1000.0000"),
			costTotalBase: new Prisma.Decimal("600.0000"),
			baseCurrency: "USD",
		},
		select: { id: true },
	});
	pricedBooking = priced.id;

	const unpriced = await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}-u`,
			customerId: a.customerId,
			ownerId: a.ownerUserId,
			status: "CONFIRMED",
			currency: "USD",
		},
		select: { id: true },
	});
	unpricedBooking = unpriced.id;

	const other = await db.booking.create({
		data: {
			agencyId: b.agencyId,
			folio: `EXP-${b.agencyId}`,
			customerId: b.customerId,
			ownerId: b.ownerUserId,
			status: "CONFIRMED",
			currency: "USD",
		},
		select: { id: true },
	});
	bookingB = other.id;

	await db.exchangeRate.create({
		data: {
			baseCurrency: "USD",
			quoteCurrency: "EUR",
			rate: new Prisma.Decimal("1.1000000000"),
			asOf: new Date(),
			source: "MANUAL",
		},
	});
});

afterEach(async () => {
	await db.commission.deleteMany({
		where: { agencyId: { in: [a.agencyId, b.agencyId] } },
	});
});

afterAll(async () => {
	await db.exchangeRate.deleteMany({
		where: { baseCurrency: "USD", quoteCurrency: "EUR" },
	});
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

function marginInput(bookingId: string, userId: string, rate: number) {
	return {
		bookingId,
		userId,
		basis: "MARGIN" as const,
		rate,
		amount: null,
		currency: null,
		note: null,
	};
}

function fixedInput(
	bookingId: string,
	userId: string,
	amount: number,
	currency: string,
) {
	return {
		bookingId,
		userId,
		basis: "FIXED" as const,
		rate: null,
		amount,
		currency,
		note: null,
	};
}

describe("commissions", () => {
	it("keeps one agency's commissions out of another's reach", async () => {
		const made = await commissions.create(
			b.agencyId,
			"owner",
			b.ownerUserId,
			fixedInput(bookingB, b.ownerUserId, 100, "USD"),
		);

		const listA = await commissions.list(
			a.agencyId,
			"owner",
			a.ownerUserId,
			LIST,
		);
		expect(listA.rows.find((row) => row.id === made.id)).toBeUndefined();

		await expect(
			commissions.byBooking(a.agencyId, "owner", a.ownerUserId, bookingB),
		).rejects.toThrow();
	});

	it("shows an agent only their own rows", async () => {
		await commissions.create(
			a.agencyId,
			"owner",
			a.ownerUserId,
			marginInput(pricedBooking, a.ownerUserId, 0.1),
		);
		await commissions.create(
			a.agencyId,
			"owner",
			a.ownerUserId,
			marginInput(pricedBooking, agentUserId, 0.2),
		);

		const list = await commissions.list(a.agencyId, "agent", agentUserId, LIST);
		expect(list.rows).toHaveLength(1);
		expect(list.rows[0]?.userId).toBe(agentUserId);

		const report = await commissions.byAdvisor(
			a.agencyId,
			"agent",
			agentUserId,
		);
		expect(report.rows.every((row) => row.userId === agentUserId)).toBe(true);
	});

	it("refuses an agent the write and the supplier report", async () => {
		await expect(
			commissions.create(
				a.agencyId,
				"agent",
				agentUserId,
				marginInput(pricedBooking, agentUserId, 0.1),
			),
		).rejects.toThrow();

		await expect(commissions.bySupplier(a.agencyId, "agent")).rejects.toThrow();
	});

	it("freezes a margin commission and only recalculate moves it", async () => {
		const made = await commissions.create(
			a.agencyId,
			"owner",
			a.ownerUserId,
			marginInput(pricedBooking, a.ownerUserId, 0.1),
		);

		const first = await commissions.byBooking(
			a.agencyId,
			"owner",
			a.ownerUserId,
			pricedBooking,
		);
		expect(first.rows[0]?.amountBase).toBe(40);

		await db.booking.update({
			where: { id: pricedBooking },
			data: { sellTotalBase: new Prisma.Decimal("2000.0000") },
		});

		const frozen = await commissions.byBooking(
			a.agencyId,
			"owner",
			a.ownerUserId,
			pricedBooking,
		);
		expect(frozen.rows[0]?.amountBase).toBe(40);

		const recalculated = await commissions.recalculate(
			a.agencyId,
			"owner",
			made.id,
		);
		expect(recalculated.amountBase).toBe(140);

		await db.booking.update({
			where: { id: pricedBooking },
			data: { sellTotalBase: new Prisma.Decimal("1000.0000") },
		});
	});

	it("discloses a missing rate instead of zeroing it", async () => {
		await commissions.create(
			a.agencyId,
			"owner",
			a.ownerUserId,
			marginInput(unpricedBooking, a.ownerUserId, 0.1),
		);

		const list = await commissions.list(a.agencyId, "owner", a.ownerUserId, {
			...LIST,
			bookingId: unpricedBooking,
		});
		expect(list.rows[0]?.amountBase).toBeNull();
		expect(list.missingRate).toBe(1);
	});

	it("converts a fixed commission and leaves a rateless one null", async () => {
		const eur = await commissions.create(
			a.agencyId,
			"owner",
			a.ownerUserId,
			fixedInput(pricedBooking, a.ownerUserId, 100, "EUR"),
		);
		const gbp = await commissions.create(
			a.agencyId,
			"owner",
			a.ownerUserId,
			fixedInput(pricedBooking, a.ownerUserId, 100, "GBP"),
		);

		const rows = (
			await commissions.byBooking(
				a.agencyId,
				"owner",
				a.ownerUserId,
				pricedBooking,
			)
		).rows;
		expect(rows.find((row) => row.id === eur.id)?.amountBase).toBe(110);
		expect(rows.find((row) => row.id === eur.id)?.baseCurrency).toBe("USD");
		expect(rows.find((row) => row.id === gbp.id)?.amountBase).toBeNull();
	});

	it("does not delete a paid commission", async () => {
		const made = await commissions.create(
			a.agencyId,
			"owner",
			a.ownerUserId,
			fixedInput(pricedBooking, a.ownerUserId, 50, "USD"),
		);
		await commissions.approve(a.agencyId, "owner", made.id);
		await commissions.markPaid(a.agencyId, "owner", made.id);

		await expect(
			commissions.remove(a.agencyId, "owner", made.id),
		).rejects.toThrow();
	});

	it("hides booking margin from an agent", async () => {
		const asAgent = await bookings.byId(a.agencyId, "agent", pricedBooking);
		expect(asAgent.marginBase).toBeNull();
		expect(asAgent.sellTotalBase).toBeNull();

		const asOwner = await bookings.byId(a.agencyId, "owner", pricedBooking);
		expect(asOwner.marginBase).toBe(400);
	});
});
