import { db } from "../../src/client";
import {
	columnFor,
	type FieldEntityName,
	type FieldTypeName,
	fieldKeyFromLabel,
	recordColumn,
} from "../../src/fields-shape";
import { Prisma } from "../../src/generated/prisma/client";
import type { AgencyBag } from "./context";
import { chance, integer, pick, type Rng } from "./random";

interface DefSpec {
	entity: FieldEntityName;
	label: string;
	type: FieldTypeName;
	required?: boolean;
	showOnTable?: boolean;
	showOnFilter?: boolean;
	archived?: boolean;
	options?: string[];
	archivedOption?: string;
}

const DEF_SPECS: DefSpec[] = [
	{
		entity: "CUSTOMER",
		label: "Account tier",
		type: "SELECT",
		showOnTable: true,
		showOnFilter: true,
		options: ["Bronze", "Silver", "Gold", "Platinum"],
		archivedOption: "Legacy",
	},
	{ entity: "CUSTOMER", label: "Lifetime trips", type: "NUMBER" },
	{ entity: "CUSTOMER", label: "VIP", type: "CHECKBOX", showOnTable: true },
	{
		entity: "CUSTOMER",
		label: "Account manager",
		type: "USER",
		showOnFilter: true,
	},
	{ entity: "CUSTOMER", label: "Website", type: "URL" },
	{
		entity: "TRAVELER",
		label: "Frequent flyer status",
		type: "SELECT",
		showOnFilter: true,
		options: ["Blue", "Silver", "Gold"],
	},
	{ entity: "TRAVELER", label: "Seat preference", type: "TEXT" },
	{ entity: "TRAVELER", label: "Passport scan on file", type: "CHECKBOX" },
	{ entity: "TRAVELER", label: "Birthday", type: "DATE" },
	{
		entity: "QUOTE",
		label: "Lead source",
		type: "SELECT",
		required: true,
		showOnTable: true,
		showOnFilter: true,
		options: ["Referral", "Web", "Repeat", "Walk-in"],
	},
	{ entity: "QUOTE", label: "Trip purpose", type: "TEXT" },
	{ entity: "QUOTE", label: "Follow-up notes", type: "LONG_TEXT" },
	{
		entity: "BOOKING",
		label: "Insurance sold",
		type: "CHECKBOX",
		showOnTable: true,
	},
	{ entity: "BOOKING", label: "Special requests", type: "LONG_TEXT" },
	{ entity: "BOOKING", label: "Contract signed on", type: "DATE" },
	{ entity: "SUPPLIER", label: "Account email", type: "EMAIL" },
	{ entity: "SUPPLIER", label: "Support phone", type: "PHONE" },
	{ entity: "SUPPLIER", label: "Portal URL", type: "URL", archived: true },
];

interface SeededDef {
	id: string;
	entity: FieldEntityName;
	type: FieldTypeName;
	optionIds: string[];
}

function recordIds(bag: AgencyBag, entity: FieldEntityName): string[] {
	switch (entity) {
		case "CUSTOMER":
			return bag.customers.map((entry) => entry.id);
		case "TRAVELER":
			return bag.travelers.map((entry) => entry.id);
		case "QUOTE":
			return bag.quotes.map((entry) => entry.id);
		case "BOOKING":
			return bag.bookings.map((entry) => entry.id);
		default:
			return bag.suppliers.map((entry) => entry.id);
	}
}

export async function seedFields(bag: AgencyBag, rng: Rng): Promise<void> {
	const positions = new Map<FieldEntityName, number>();
	const defs: SeededDef[] = [];

	for (const spec of DEF_SPECS) {
		const position = positions.get(spec.entity) ?? 0;
		positions.set(spec.entity, position + 1);

		const definition = await db.fieldDefinition.create({
			data: {
				agencyId: bag.agencyId,
				entity: spec.entity,
				key: fieldKeyFromLabel(spec.label),
				label: spec.label,
				type: spec.type,
				required: spec.required ?? false,
				showOnSheet: true,
				showOnTable: spec.showOnTable ?? false,
				showOnFilter: spec.showOnFilter ?? false,
				position,
				archivedAt: spec.archived ? new Date() : null,
			},
		});

		const optionIds: string[] = [];
		if (spec.options) {
			for (let index = 0; index < spec.options.length; index += 1) {
				const option = await db.fieldOption.create({
					data: {
						agencyId: bag.agencyId,
						fieldId: definition.id,
						label: spec.options[index] as string,
						position: index,
					},
				});
				optionIds.push(option.id);
			}
			if (spec.archivedOption) {
				await db.fieldOption.create({
					data: {
						agencyId: bag.agencyId,
						fieldId: definition.id,
						label: spec.archivedOption,
						position: spec.options.length,
						archivedAt: new Date(),
					},
				});
			}
		}

		defs.push({
			id: definition.id,
			entity: spec.entity,
			type: spec.type,
			optionIds,
		});
	}

	const userIds = bag.users.map((user) => user.id);

	for (const def of defs) {
		if (def.type === "USER" && userIds.length === 0) continue;
		const ids = recordIds(bag, def.entity);
		const column = columnFor(def.type);
		const rows: Prisma.FieldValueCreateManyInput[] = [];

		for (const recordId of ids) {
			if (!chance(rng, 0.7)) continue;
			const base: Prisma.FieldValueCreateManyInput = {
				agencyId: bag.agencyId,
				fieldId: def.id,
				[recordColumn(def.entity)]: recordId,
			};

			if (column === "text") {
				base.text = pick(rng, [
					"Ventana",
					"Pasillo",
					"Negocios",
					"https://ejemplo.example",
					"ventas@ejemplo.example",
					"+52 55 6000 0000",
					"Luna de miel",
				]);
			} else if (column === "number") {
				base.number = new Prisma.Decimal(integer(rng, 1, 24));
			} else if (column === "date") {
				base.date = new Date(
					Date.UTC(
						1980 + integer(rng, 0, 30),
						integer(rng, 0, 11),
						integer(rng, 1, 28),
					),
				);
			} else if (column === "bool") {
				base.bool = chance(rng, 0.5);
			} else if (column === "optionId") {
				if (def.optionIds.length === 0) continue;
				base.optionId = pick(rng, def.optionIds);
			} else {
				base.userId = pick(rng, userIds);
			}

			rows.push(base);
		}

		if (rows.length > 0) {
			await db.fieldValue.createMany({ data: rows, skipDuplicates: true });
		}
	}
}

interface ViewSpec {
	entity: FieldEntityName;
	name: string;
	ownerKey: string;
	shared: boolean;
	filters: Record<string, string[]>;
	sort?: string;
	dir?: "asc" | "desc";
	archived?: boolean;
}

const VIEW_SPECS: ViewSpec[] = [
	{
		entity: "BOOKING",
		name: "Confirmed departures",
		ownerKey: "admin",
		shared: true,
		filters: { status: ["CONFIRMED", "TRAVELING"] },
		sort: "travelStartDate",
		dir: "asc",
	},
	{
		entity: "BOOKING",
		name: "Archived",
		ownerKey: "admin",
		shared: true,
		filters: {},
		archived: true,
	},
	{
		entity: "QUOTE",
		name: "Unassigned",
		ownerKey: "admin",
		shared: true,
		filters: { owner: ["unassigned"] },
	},
	{
		entity: "QUOTE",
		name: "Sent this week",
		ownerKey: "agent1",
		shared: false,
		filters: { status: ["SENT"] },
		sort: "createdAt",
		dir: "desc",
	},
	{
		entity: "CUSTOMER",
		name: "Companies",
		ownerKey: "admin",
		shared: true,
		filters: { type: ["COMPANY"] },
	},
	{
		entity: "CUSTOMER",
		name: "My accounts",
		ownerKey: "agent2",
		shared: false,
		filters: {},
	},
	{
		entity: "SUPPLIER",
		name: "Hotels",
		ownerKey: "admin",
		shared: true,
		filters: { kind: ["HOTEL"] },
	},
	{
		entity: "TRAVELER",
		name: "Passport holders",
		ownerKey: "agent1",
		shared: false,
		filters: { documentType: ["PASSPORT"] },
	},
];

export async function seedSavedViews(bag: AgencyBag): Promise<void> {
	for (const spec of VIEW_SPECS) {
		const owner =
			bag.users.find((user) => user.key === spec.ownerKey) ?? bag.users[0];
		if (!owner) continue;
		await db.savedView.create({
			data: {
				agencyId: bag.agencyId,
				entity: spec.entity,
				name: spec.name,
				shared: spec.shared,
				ownerId: owner.id,
				filters: {
					q: "",
					sort: spec.sort ?? "",
					dir: spec.dir ?? "asc",
					archived: spec.archived ?? false,
					filters: spec.filters,
				},
			},
		});
	}
}
