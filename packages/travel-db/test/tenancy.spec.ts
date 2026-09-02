import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { db } from "../src/client";
import { agencyDb } from "../src/tenancy";

const suffix = process.env.TEST_RUN_ID ?? "tenancy-spec";

const agencyA = `${suffix}-a`;
const agencyB = `${suffix}-b`;

let ownerId: string;
let bookingA: string;
let bookingB: string;
let customerA: string;

async function seedAgency(id: string): Promise<{
	bookingId: string;
	customerId: string;
}> {
	await db.organization.create({
		data: { id, name: id, slug: id, createdAt: new Date() },
	});

	const customer = await db.customer.create({
		data: { agencyId: id, name: `Customer ${id}`, ownerId },
	});

	const booking = await db.booking.create({
		data: {
			agencyId: id,
			folio: `EXP-${id}`,
			customerId: customer.id,
			status: "CONFIRMED",
		},
	});

	return { bookingId: booking.id, customerId: customer.id };
}

beforeAll(async () => {
	await cleanup();

	const owner = await db.user.create({
		data: {
			id: `${suffix}-owner`,
			name: "Owner",
			email: `owner.${suffix}@example.test`,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
	ownerId = owner.id;

	const seededA = await seedAgency(agencyA);
	const seededB = await seedAgency(agencyB);
	bookingA = seededA.bookingId;
	bookingB = seededB.bookingId;
	customerA = seededA.customerId;
});

afterAll(async () => {
	await cleanup();
	await db.$disconnect();
});

async function cleanup(): Promise<void> {
	for (const id of [agencyA, agencyB]) {
		await db.booking.deleteMany({ where: { agencyId: id } });
		await db.customer.deleteMany({ where: { agencyId: id } });
		await db.organization.deleteMany({ where: { id } });
	}
	await db.user.deleteMany({
		where: { email: { endsWith: `.${suffix}@example.test` } },
	});
}

describe("agencyDb", () => {
	it("findMany returns only the caller's rows", async () => {
		const rows = await agencyDb(db, agencyA).booking.findMany();
		expect(rows.map((row) => row.id)).toEqual([bookingA]);
	});

	it("findFirst cannot reach another agency's row", async () => {
		const row = await agencyDb(db, agencyA).booking.findFirst({
			where: { id: bookingB },
		});
		expect(row).toBeNull();
	});

	it("update throws P2025 on another agency's row", async () => {
		const attempt = agencyDb(db, agencyA).booking.update({
			where: { id: bookingB },
			data: { status: "CANCELLED" },
		});
		await expect(attempt).rejects.toThrow();

		const untouched = await db.booking.findUniqueOrThrow({
			where: { id: bookingB },
		});
		expect(untouched.status).toBe("CONFIRMED");
	});

	it("deleteMany does not reach another agency's rows", async () => {
		const result = await agencyDb(db, agencyA).booking.deleteMany({
			where: { id: bookingB },
		});
		expect(result.count).toBe(0);

		const stillThere = await db.booking.findFirst({ where: { id: bookingB } });
		expect(stillThere).not.toBeNull();
	});

	it("findUnique is refused", async () => {
		await expect(
			agencyDb(db, agencyA).booking.findUnique({ where: { id: bookingA } }),
		).rejects.toThrow(/cannot be tenant-scoped/);
	});

	it("create pins agencyId even when data says otherwise", async () => {
		const created = await agencyDb(db, agencyA).booking.create({
			data: {
				agencyId: agencyB,
				folio: `EXP-${randomUUID()}`,
				customerId: customerA,
				status: "DRAFT",
			},
		});
		expect(created.agencyId).toBe(agencyA);

		await db.booking.delete({ where: { id: created.id } });
	});
});
