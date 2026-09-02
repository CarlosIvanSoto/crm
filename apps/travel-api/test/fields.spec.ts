import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { db } from "@travel/db";
import { FieldsService } from "../src/fields/fields.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const fields = new FieldsService(db);

let a: SeededAgency;
let b: SeededAgency;
let fieldId: string;

beforeAll(async () => {
	a = await seedAgency("fld-a");
	b = await seedAgency("fld-b");

	const created = await fields.create(a.agencyId, {
		entity: "CUSTOMER",
		label: "Tier",
		type: "SELECT",
		options: [{ label: "Gold" }, { label: "Silver" }],
		required: false,
		showOnSheet: true,
		showOnTable: true,
		showOnFilter: true,
	});
	fieldId = created.id;
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await dropAgency(b.agencyId);
	await db.$disconnect();
});

describe("fields — per agency, tenant-scoped", () => {
	it("lists only the owning agency's definitions", async () => {
		const mine = await fields.list(a.agencyId, "CUSTOMER", false);
		expect(mine.map((field) => field.key)).toEqual(["tier"]);

		const other = await fields.list(b.agencyId, "CUSTOMER", false);
		expect(other).toHaveLength(0);
	});

	it("writes and reads a value on a record of the same agency", async () => {
		const written = await fields.setValues(
			a.agencyId,
			"CUSTOMER",
			a.customerId,
			{
				tier: "Gold",
			},
		);
		const tier = written.find((field) => field.key === "tier");
		const gold = tier?.options.find((option) => option.label === "Gold");
		expect(gold).toBeDefined();
		expect(tier?.value).toBe(gold?.id);

		const readBack = await fields.valuesFor(
			a.agencyId,
			"CUSTOMER",
			a.customerId,
		);
		expect(readBack.find((field) => field.key === "tier")?.value).toBe(
			gold?.id,
		);
	});

	it("refuses to write a value on another agency's record", async () => {
		await expect(
			fields.setValues(b.agencyId, "CUSTOMER", a.customerId, { tier: "Gold" }),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("rejects an option that does not exist", async () => {
		await expect(
			fields.setValues(a.agencyId, "CUSTOMER", a.customerId, {
				tier: "Bronze",
			}),
		).rejects.toThrow();
	});

	it("blocks a type change once the field holds values", async () => {
		await expect(
			fields.update(a.agencyId, fieldId, { type: "TEXT" }),
		).rejects.toThrow();
	});
});
