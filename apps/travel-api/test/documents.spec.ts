import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import type { DocumentListInput } from "../src/documents/documents.contracts";
import { DocumentsService } from "../src/documents/documents.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const documents = new DocumentsService(db);

const FAKE_BLOB_TOKEN = "vercel_blob_rw_testfixture_1234567890abcdef";

const LIST: DocumentListInput = {
	q: "",
	sort: "",
	dir: "asc",
	page: 1,
	pageSize: 25,
	bookingId: undefined,
	travelerId: undefined,
	kind: [],
};

let a: SeededAgency;
let b: SeededAgency;
let agentUserId: string;
let otherAgentUserId: string;
let bookingA1: string;
let bookingA2: string;
let bookingB: string;

async function addMember(agencyId: string, tag: string): Promise<string> {
	const user = await db.user.create({
		data: {
			id: `${agencyId}-${tag}`,
			name: tag,
			email: `${tag}.${agencyId}@example.test`,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
	await db.member.create({
		data: {
			id: `${agencyId}-${tag}-member`,
			organizationId: agencyId,
			userId: user.id,
			role: "agent",
			createdAt: new Date(),
		},
	});
	return user.id;
}

beforeAll(async () => {
	a = await seedAgency("doc-a");
	b = await seedAgency("doc-b");

	agentUserId = await addMember(a.agencyId, "agent");
	otherAgentUserId = await addMember(a.agencyId, "agent2");

	const booking1 = await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}-1`,
			customerId: a.customerId,
			ownerId: agentUserId,
			status: "CONFIRMED",
			currency: "USD",
		},
		select: { id: true },
	});
	bookingA1 = booking1.id;

	const booking2 = await db.booking.create({
		data: {
			agencyId: a.agencyId,
			folio: `EXP-${a.agencyId}-2`,
			customerId: a.customerId,
			ownerId: otherAgentUserId,
			status: "CONFIRMED",
			currency: "USD",
		},
		select: { id: true },
	});
	bookingA2 = booking2.id;

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
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

describe("documents — storage not configured", () => {
	it("uploadToken responds with 'not configured' without a blob token", async () => {
		await expect(
			documents.uploadToken(a.agencyId, {
				bookingId: bookingA1,
				filename: "voucher.pdf",
				contentType: "application/pdf",
				sizeBytes: 1000,
				kind: "VOUCHER",
			}),
		).rejects.toThrow(/not configured/);
	});
});

describe("documents — with storage configured", () => {
	const previousToken = process.env.TRAVEL_BLOB_READ_WRITE_TOKEN;

	beforeAll(() => {
		process.env.TRAVEL_BLOB_READ_WRITE_TOKEN = FAKE_BLOB_TOKEN;
	});

	afterAll(() => {
		if (previousToken === undefined) {
			delete process.env.TRAVEL_BLOB_READ_WRITE_TOKEN;
		} else {
			process.env.TRAVEL_BLOB_READ_WRITE_TOKEN = previousToken;
		}
	});

	it("rejects a content type outside the allow list", async () => {
		await expect(
			documents.uploadToken(a.agencyId, {
				bookingId: bookingA1,
				filename: "malware.exe",
				contentType: "application/x-msdownload",
				sizeBytes: 1000,
				kind: "OTHER",
			}),
		).rejects.toThrow();
	});

	it("rejects a file over the size limit", async () => {
		await expect(
			documents.uploadToken(a.agencyId, {
				bookingId: bookingA1,
				filename: "huge.pdf",
				contentType: "application/pdf",
				sizeBytes: 100 * 1024 * 1024,
				kind: "VOUCHER",
			}),
		).rejects.toThrow();
	});

	it("rejects an anchor from another agency", async () => {
		await expect(
			documents.uploadToken(a.agencyId, {
				bookingId: bookingB,
				filename: "voucher.pdf",
				contentType: "application/pdf",
				sizeBytes: 1000,
				kind: "VOUCHER",
			}),
		).rejects.toThrow();
	});

	it("mints a pathname scoped to the agency", async () => {
		const result = await documents.uploadToken(a.agencyId, {
			bookingId: bookingA1,
			filename: "voucher.pdf",
			contentType: "application/pdf",
			sizeBytes: 1000,
			kind: "VOUCHER",
		});
		expect(result.pathname.startsWith(`agencies/${a.agencyId}/`)).toBe(true);
		expect(result.token.length).toBeGreaterThan(0);
	});
});

describe("documents — tenancy and scope", () => {
	it("rejects create with a pathname from another agency", async () => {
		await expect(
			documents.create(a.agencyId, a.ownerUserId, {
				bookingId: bookingA1,
				kind: "VOUCHER",
				pathname: `agencies/${b.agencyId}/${bookingB}/voucher.pdf`,
				url: "https://example.test/voucher.pdf",
				filename: "voucher.pdf",
				contentType: "application/pdf",
				sizeBytes: 1000,
			}),
		).rejects.toThrow();
	});

	it("agency A does not see agency B's document", async () => {
		const docB = await db.document.create({
			data: {
				agencyId: b.agencyId,
				bookingId: bookingB,
				kind: "VOUCHER",
				pathname: `agencies/${b.agencyId}/${bookingB}/voucher.pdf`,
				url: "https://example.test/b-voucher.pdf",
				filename: "voucher.pdf",
				uploadedById: b.ownerUserId,
			},
		});

		const list = await documents.list(a.agencyId, "owner", a.ownerUserId, LIST);
		expect(list.rows.some((row) => row.id === docB.id)).toBe(false);
	});

	it("an agent does not see a document on another advisor's booking", async () => {
		const doc = await db.document.create({
			data: {
				agencyId: a.agencyId,
				bookingId: bookingA2,
				kind: "TICKET",
				pathname: `agencies/${a.agencyId}/${bookingA2}/ticket.pdf`,
				url: "https://example.test/ticket.pdf",
				filename: "ticket.pdf",
				uploadedById: otherAgentUserId,
			},
		});

		const list = await documents.list(a.agencyId, "agent", agentUserId, LIST);
		expect(list.rows.some((row) => row.id === doc.id)).toBe(false);

		await db.document.delete({ where: { id: doc.id } });
	});

	it("an agent sees a document on their own booking", async () => {
		const doc = await db.document.create({
			data: {
				agencyId: a.agencyId,
				bookingId: bookingA1,
				kind: "VOUCHER",
				pathname: `agencies/${a.agencyId}/${bookingA1}/own.pdf`,
				url: "https://example.test/own.pdf",
				filename: "own.pdf",
				uploadedById: a.ownerUserId,
			},
		});

		const list = await documents.list(a.agencyId, "agent", agentUserId, LIST);
		expect(list.rows.some((row) => row.id === doc.id)).toBe(true);

		await db.document.delete({ where: { id: doc.id } });
	});

	it("an agent who did not upload the file cannot remove it", async () => {
		const doc = await db.document.create({
			data: {
				agencyId: a.agencyId,
				bookingId: bookingA1,
				kind: "VOUCHER",
				pathname: `agencies/${a.agencyId}/${bookingA1}/remove-1.pdf`,
				url: "https://example.test/remove-1.pdf",
				filename: "remove-1.pdf",
				uploadedById: a.ownerUserId,
			},
		});

		await expect(
			documents.remove(a.agencyId, "agent", agentUserId, doc.id),
		).rejects.toThrow();

		await db.document.delete({ where: { id: doc.id } });
	});

	it("the uploader can remove their own document", async () => {
		const doc = await db.document.create({
			data: {
				agencyId: a.agencyId,
				bookingId: bookingA1,
				kind: "VOUCHER",
				pathname: `agencies/${a.agencyId}/${bookingA1}/remove-2.pdf`,
				url: "https://example.test/remove-2.pdf",
				filename: "remove-2.pdf",
				uploadedById: agentUserId,
			},
		});

		const result = await documents.remove(
			a.agencyId,
			"agent",
			agentUserId,
			doc.id,
		);
		expect(result.id).toBe(doc.id);

		const gone = await db.document.findFirst({ where: { id: doc.id } });
		expect(gone).toBeNull();
	});

	it("the entry output never carries pathname or url", async () => {
		const doc = await db.document.create({
			data: {
				agencyId: a.agencyId,
				bookingId: bookingA1,
				kind: "VOUCHER",
				pathname: `agencies/${a.agencyId}/${bookingA1}/shape.pdf`,
				url: "https://example.test/shape.pdf",
				filename: "shape.pdf",
				uploadedById: a.ownerUserId,
			},
		});

		const list = await documents.list(a.agencyId, "owner", a.ownerUserId, LIST);
		const row = list.rows.find((r) => r.id === doc.id);
		expect(row).toBeDefined();
		expect(row).not.toHaveProperty("pathname");
		expect(row).not.toHaveProperty("url");

		await db.document.delete({ where: { id: doc.id } });
	});
});
