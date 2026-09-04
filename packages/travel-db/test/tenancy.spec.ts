import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { db } from "../src/client";
import { agencyDb } from "../src/tenancy";

async function rejection(run: () => PromiseLike<unknown>): Promise<Error> {
	try {
		await run();
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}
	throw new Error("Expected the call to reject, but it resolved.");
}

const suffix = process.env.TEST_RUN_ID ?? "tenancy-spec";

const agencyA = `${suffix}-a`;
const agencyB = `${suffix}-b`;

let ownerId: string;
let bookingA: string;
let bookingB: string;
let customerA: string;
let commissionB: string;
let quoteShareB: string;
let documentB: string;

async function seedAgency(id: string): Promise<{
	bookingId: string;
	customerId: string;
	commissionId: string;
	quoteShareId: string;
	documentId: string;
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

	const commission = await db.commission.create({
		data: {
			agencyId: id,
			bookingId: booking.id,
			userId: ownerId,
			createdById: ownerId,
			basis: "MARGIN",
			rate: "0.1000",
		},
	});

	const quote = await db.quote.create({
		data: {
			agencyId: id,
			folio: `COT-${id}`,
			customerId: customer.id,
		},
	});

	const quoteShare = await db.quoteShare.create({
		data: {
			agencyId: id,
			quoteId: quote.id,
			tokenHash: `hash-${id}`,
			createdById: ownerId,
		},
	});

	const document = await db.document.create({
		data: {
			agencyId: id,
			bookingId: booking.id,
			kind: "VOUCHER",
			pathname: `agencies/${id}/${booking.id}/voucher.pdf`,
			url: `https://example.test/${id}/voucher.pdf`,
			filename: "voucher.pdf",
			uploadedById: ownerId,
		},
	});

	return {
		bookingId: booking.id,
		customerId: customer.id,
		commissionId: commission.id,
		quoteShareId: quoteShare.id,
		documentId: document.id,
	};
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
	commissionB = seededB.commissionId;
	quoteShareB = seededB.quoteShareId;
	documentB = seededB.documentId;
});

afterAll(async () => {
	await cleanup();
	await db.$disconnect();
});

async function cleanup(): Promise<void> {
	for (const id of [agencyA, agencyB]) {
		await db.document.deleteMany({ where: { agencyId: id } });
		await db.commission.deleteMany({ where: { agencyId: id } });
		await db.quoteShare.deleteMany({ where: { agencyId: id } });
		await db.quote.deleteMany({ where: { agencyId: id } });
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
		const error = await rejection(() =>
			agencyDb(db, agencyA).booking.update({
				where: { id: bookingB },
				data: { status: "CANCELLED" },
			}),
		);
		expect(error).toBeInstanceOf(Error);

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
		const error = await rejection(() =>
			agencyDb(db, agencyA).booking.findUnique({ where: { id: bookingA } }),
		);
		expect(error.message).toMatch(/cannot be tenant-scoped/);
	});

	it("findUniqueOrThrow is refused", async () => {
		const error = await rejection(() =>
			agencyDb(db, agencyA).booking.findUniqueOrThrow({
				where: { id: bookingA },
			}),
		);
		expect(error.message).toMatch(/cannot be tenant-scoped/);
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

	it("createMany pins agencyId on every row", async () => {
		const folios = [randomUUID(), randomUUID()];
		await agencyDb(db, agencyA).booking.createMany({
			data: folios.map((folio) => ({
				agencyId: agencyB,
				folio: `EXP-${folio}`,
				customerId: customerA,
				status: "DRAFT" as const,
			})),
		});

		const rows = await db.booking.findMany({
			where: { folio: { in: folios.map((folio) => `EXP-${folio}`) } },
			select: { agencyId: true },
		});
		expect(rows).toHaveLength(2);
		expect(rows.every((row) => row.agencyId === agencyA)).toBe(true);

		await db.booking.deleteMany({
			where: { folio: { in: folios.map((folio) => `EXP-${folio}`) } },
		});
	});

	it("upsert pins agencyId on the created row", async () => {
		const folio = `EXP-${randomUUID()}`;
		const scoped = agencyDb(db, agencyA);

		const first = await scoped.booking.upsert({
			where: { agencyId_folio: { agencyId: agencyA, folio } },
			create: {
				agencyId: agencyB,
				folio,
				customerId: customerA,
				status: "DRAFT",
			},
			update: { status: "CONFIRMED" },
		});
		expect(first.agencyId).toBe(agencyA);

		await db.booking.delete({ where: { id: first.id } });
	});

	it("lets a non-tenant model through unscoped", async () => {
		const rows = await agencyDb(db, agencyA).organization.findMany({
			where: { id: { in: [agencyA, agencyB] } },
			select: { id: true },
		});
		expect(rows.map((row) => row.id).sort()).toEqual([agencyA, agencyB].sort());
	});

	it("scopes commission the same way", async () => {
		const unreachable = await agencyDb(db, agencyA).commission.findFirst({
			where: { id: commissionB },
		});
		expect(unreachable).toBeNull();

		const created = await agencyDb(db, agencyA).commission.create({
			data: {
				agencyId: agencyB,
				bookingId: bookingA,
				userId: ownerId,
				createdById: ownerId,
				basis: "FIXED",
				amount: "50.00",
				currency: "USD",
			},
		});
		expect(created.agencyId).toBe(agencyA);

		await db.commission.delete({ where: { id: created.id } });
	});

	it("scopes quoteShare the same way", async () => {
		const unreachable = await agencyDb(db, agencyA).quoteShare.findFirst({
			where: { id: quoteShareB },
		});
		expect(unreachable).toBeNull();

		const quoteA = await db.quote.findFirstOrThrow({
			where: { agencyId: agencyA },
			select: { id: true },
		});

		const created = await agencyDb(db, agencyA).quoteShare.create({
			data: {
				agencyId: agencyB,
				quoteId: quoteA.id,
				tokenHash: `hash-${randomUUID()}`,
				createdById: ownerId,
			},
		});
		expect(created.agencyId).toBe(agencyA);

		await db.quoteShare.delete({ where: { id: created.id } });
	});

	it("scopes document the same way", async () => {
		const unreachable = await agencyDb(db, agencyA).document.findFirst({
			where: { id: documentB },
		});
		expect(unreachable).toBeNull();

		const created = await agencyDb(db, agencyA).document.create({
			data: {
				agencyId: agencyB,
				bookingId: bookingA,
				kind: "TICKET",
				pathname: `agencies/${agencyA}/${bookingA}/${randomUUID()}.pdf`,
				url: `https://example.test/${randomUUID()}.pdf`,
				filename: "ticket.pdf",
				uploadedById: ownerId,
			},
		});
		expect(created.agencyId).toBe(agencyA);

		await db.document.delete({ where: { id: created.id } });
	});

	it("does not scope a nested create, so it fails closed", async () => {
		const error = await rejection(() =>
			agencyDb(db, agencyA).booking.create({
				data: {
					agencyId: agencyA,
					folio: `EXP-${randomUUID()}`,
					customerId: customerA,
					status: "DRAFT",
					items: {
						create: [{ type: "OTHER", details: { type: "OTHER" } }],
					},
				},
			}),
		);
		expect(error).toBeInstanceOf(Error);
	});
});
