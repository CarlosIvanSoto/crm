import { db } from "../../src/client";
import {
	COMPANY_NAMES,
	FIRST_NAMES,
	LAST_NAMES,
	LOYALTY_PROGRAMS,
	personName,
	SUPPLIER_NAMES,
} from "./catalog";
import type { AgencyBag, SeededTraveler } from "./context";
import { chance, daysFromNow, integer, pick, type Rng, sample } from "./random";

const SUPPLIER_KINDS = [
	"WHOLESALER",
	"DMC",
	"HOTEL",
	"AIRLINE",
	"CRUISE",
	"INSURANCE",
	"TRANSFER",
	"TOUR_OPERATOR",
	"CAR_RENTAL",
	"OTHER",
	"HOTEL",
	"WHOLESALER",
] as const;

const SUPPLIER_CURRENCIES = ["USD", "EUR", "GBP", "USD", "EUR", "USD"];

export async function seedSuppliers(bag: AgencyBag, rng: Rng): Promise<void> {
	for (let index = 0; index < SUPPLIER_KINDS.length; index += 1) {
		const kind = SUPPLIER_KINDS[index] ?? "OTHER";
		const archived = index >= SUPPLIER_KINDS.length - 2;
		const currency = pick(rng, SUPPLIER_CURRENCIES);
		const hasRate = chance(rng, 0.65);
		const supplier = await db.supplier.create({
			data: {
				agencyId: bag.agencyId,
				kind,
				name: `${SUPPLIER_NAMES[index] ?? `Proveedor ${index + 1}`}`,
				email: `ventas${index + 1}@${bag.spec.slug}-sup.example`,
				phone: "+52 55 4000 0000",
				defaultCurrency: currency,
				defaultCommissionRate: hasRate
					? (integer(rng, 5, 14) / 100).toFixed(4)
					: null,
				paymentTermsDays: pick(rng, [7, 14, 30, 45]),
				notes: chance(rng, 0.4) ? "Tarifa neta negociada para 2026." : null,
				archivedAt: archived ? daysFromNow(-integer(rng, 30, 120)) : null,
			},
		});
		bag.suppliers.push({
			id: supplier.id,
			kind,
			name: supplier.name,
			currency,
			archived,
		});
	}
}

const CUSTOMER_COUNT = 24;

export async function seedCustomers(bag: AgencyBag, rng: Rng): Promise<void> {
	const owners = bag.users.filter((user) => user.role !== "accountant");

	for (let index = 0; index < CUSTOMER_COUNT; index += 1) {
		const isCompany = index >= 18;
		const type = isCompany ? "COMPANY" : "PERSON";
		const name = isCompany
			? (COMPANY_NAMES[index - 18] ?? `Empresa ${index}`)
			: personName(rng);
		const unassigned = index % 6 === 0 && index < 24;
		const archived = index >= 21;
		const ownerId = unassigned ? null : pick(rng, owners).id;
		const customer = await db.customer.create({
			data: {
				agencyId: bag.agencyId,
				type,
				name,
				legalName: isCompany ? `${name} S.A. de C.V.` : null,
				taxId: isCompany ? `RFC${integer(rng, 100000, 999999)}` : null,
				email: `cliente${index + 1}@${bag.spec.slug}.example`,
				phone: chance(rng, 0.85) ? "+52 55 5000 0000" : null,
				whatsapp: chance(rng, 0.4) ? "+52 55 5000 0001" : null,
				ownerId,
				lastActivityAt: daysFromNow(-integer(rng, 1, 120)),
				archivedAt: archived ? daysFromNow(-integer(rng, 10, 90)) : null,
			},
		});
		bag.customers.push({
			id: customer.id,
			type,
			name,
			email: customer.email as string,
			ownerId,
			archived,
		});
	}
}

const DOC_TYPES = [
	"PASSPORT",
	"PASSPORT",
	"PASSPORT",
	"ID",
	"VISA",
	null,
] as const;

export async function seedTravelers(bag: AgencyBag, rng: Rng): Promise<void> {
	const anchors = bag.customers.filter((customer) => !customer.archived);
	const airlineSuppliers = bag.suppliers.filter(
		(supplier) => supplier.kind === "AIRLINE" || supplier.kind === "HOTEL",
	);

	const travelers: SeededTraveler[] = [];

	for (let index = 0; index < 30; index += 1) {
		const customer = pick(rng, anchors);
		const soonExpiry = index === 0;
		const documentType = soonExpiry ? "PASSPORT" : pick(rng, DOC_TYPES);
		const expires = soonExpiry
			? daysFromNow(20)
			: documentType
				? daysFromNow(integer(rng, 400, 2200))
				: null;
		const traveler = await db.traveler.create({
			data: {
				agencyId: bag.agencyId,
				firstName: pick(rng, FIRST_NAMES),
				lastName: pick(rng, LAST_NAMES),
				customerId: customer.id,
				dateOfBirth: daysFromNow(-integer(rng, 6600, 24000)),
				nationality: pick(rng, ["MX", "ES", "AR", "CO", "PE"]),
				documentType,
				documentNumber: documentType
					? `${pick(rng, ["MX", "ES", "AR"])}${integer(rng, 1000000, 9999999)}`
					: null,
				documentIssuedCountry: documentType
					? pick(rng, ["MX", "ES", "AR"])
					: null,
				documentExpiresAt: expires,
				dietaryNotes: chance(rng, 0.2) ? "Vegetariano" : null,
			},
		});
		travelers.push({
			id: traveler.id,
			customerId: customer.id,
			name: `${traveler.firstName} ${traveler.lastName}`,
		});
	}

	bag.travelers.push(...travelers);

	for (const traveler of sample(rng, travelers, 8)) {
		await db.travelerLoyalty.create({
			data: {
				agencyId: bag.agencyId,
				travelerId: traveler.id,
				programName: pick(rng, LOYALTY_PROGRAMS),
				number: `${integer(rng, 100000000, 999999999)}`,
				supplierId:
					chance(rng, 0.6) && airlineSuppliers.length > 0
						? pick(rng, airlineSuppliers).id
						: null,
			},
		});
	}
}
