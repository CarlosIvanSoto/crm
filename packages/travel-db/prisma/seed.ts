import { randomUUID } from "node:crypto";
import { db } from "../src/client";
import { COUNTER_KIND, formatFolio } from "../src/folio";

function makeRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = makeRandom(20260902);

function pick<T>(values: readonly T[]): T {
	const value = values[Math.floor(random() * values.length)];
	if (value === undefined) {
		throw new Error("pick called on an empty list");
	}
	return value;
}

const AGENCIES = [
	{ slug: "andes-travel", name: "Andes Travel", owner: "owner@andes.example" },
	{ slug: "maya-tours", name: "Maya Tours", owner: "owner@maya.example" },
] as const;

const FIRST_NAMES = ["María", "Carlos", "Lucía", "Diego", "Sofía", "Javier"];
const LAST_NAMES = [
	"García",
	"Hernández",
	"López",
	"Martínez",
	"Torres",
	"Ruiz",
];
const DESTINATIONS = ["Cancún", "Madrid", "Tokio", "Buenos Aires", "Roma"];

async function main(): Promise<void> {
	for (const agency of AGENCIES) {
		await seedAgency(agency.slug, agency.name, agency.owner);
	}
	console.log(`Seeded ${AGENCIES.length} agencies.`);
}

async function seedAgency(
	slug: string,
	name: string,
	ownerEmail: string,
): Promise<void> {
	const agencyId = randomUUID();

	await db.organization.create({
		data: { id: agencyId, name, slug, createdAt: new Date() },
	});

	const ownerId = randomUUID();
	await db.user.create({
		data: {
			id: ownerId,
			name: "Agency Owner",
			email: ownerEmail,
			emailVerified: true,
		},
	});
	await db.member.create({
		data: {
			id: randomUUID(),
			organizationId: agencyId,
			userId: ownerId,
			role: "owner",
			createdAt: new Date(),
		},
	});

	await db.agencySettings.create({
		data: { agencyId, baseCurrency: "USD", email: ownerEmail },
	});
	await db.agencyCounter.createMany({
		data: [
			{ agencyId, kind: COUNTER_KIND.quote, value: 0 },
			{ agencyId, kind: COUNTER_KIND.booking, value: 0 },
		],
	});

	const year = new Date().getFullYear();

	for (let index = 1; index <= 3; index += 1) {
		const customer = await db.customer.create({
			data: {
				agencyId,
				name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
				email: `cliente${index}@${slug}.example`,
				phone: "+52 55 0000 0000",
				ownerId,
			},
		});

		const traveler = await db.traveler.create({
			data: {
				agencyId,
				firstName: pick(FIRST_NAMES),
				lastName: pick(LAST_NAMES),
				customerId: customer.id,
				documentType: "PASSPORT",
				documentNumber: `MX${100000 + index}`,
				documentExpiresAt: new Date(year + 5, 0, 1),
			},
		});

		const supplier = await db.supplier.create({
			data: {
				agencyId,
				kind: "WHOLESALER",
				name: `Mayorista ${index}`,
				defaultCurrency: "USD",
			},
		});

		const destination = pick(DESTINATIONS);

		const quote = await db.quote.create({
			data: {
				agencyId,
				folio: formatFolio("COT", year, index),
				customerId: customer.id,
				ownerId,
				status: "SENT",
				destination,
				currency: "USD",
				paxAdults: 2,
				options: {
					create: [
						{
							agencyId,
							label: "Económica",
							position: 0,
							items: {
								create: [
									{
										agencyId,
										type: "FLIGHT",
										supplierId: supplier.id,
										sellAmount: "820.00",
										sellCurrency: "USD",
										costAmount: "720.00",
										costCurrency: "USD",
									},
									{
										agencyId,
										type: "HOTEL",
										supplierId: supplier.id,
										sellAmount: "640.00",
										sellCurrency: "USD",
										costAmount: "520.00",
										costCurrency: "USD",
									},
								],
							},
						},
						{
							agencyId,
							label: "Premium",
							position: 1,
							isRecommended: true,
							items: {
								create: [
									{
										agencyId,
										type: "FLIGHT",
										supplierId: supplier.id,
										sellAmount: "1250.00",
										sellCurrency: "USD",
										costAmount: "1080.00",
										costCurrency: "USD",
									},
								],
							},
						},
					],
				},
			},
		});

		if (index === 1) {
			const booking = await db.booking.create({
				data: {
					agencyId,
					folio: formatFolio("EXP", year, index),
					customerId: customer.id,
					ownerId,
					quoteId: quote.id,
					status: "CONFIRMED",
					destination,
					currency: "USD",
					travelers: {
						create: { agencyId, travelerId: traveler.id, isLead: true },
					},
					items: {
						create: {
							agencyId,
							type: "HOTEL",
							supplierId: supplier.id,
							status: "CONFIRMED",
							confirmationCode: "HTL-001",
							sellAmount: "640.00",
							sellCurrency: "USD",
							costAmount: "520.00",
							costCurrency: "USD",
						},
					},
				},
			});

			await db.payment.createMany({
				data: [
					{
						agencyId,
						bookingId: booking.id,
						dueDate: new Date(),
						amount: "300.00",
						currency: "USD",
						status: "PAID",
						method: "TRANSFER",
						paidAt: new Date(),
					},
					{
						agencyId,
						bookingId: booking.id,
						dueDate: new Date(year, 11, 1),
						amount: "340.00",
						currency: "USD",
						status: "SCHEDULED",
					},
				],
			});
		}
	}

	await db.agencyCounter.update({
		where: { agencyId_kind: { agencyId, kind: COUNTER_KIND.quote } },
		data: { value: 3 },
	});
	await db.agencyCounter.update({
		where: { agencyId_kind: { agencyId, kind: COUNTER_KIND.booking } },
		data: { value: 1 },
	});
}

main()
	.then(() => db.$disconnect())
	.catch(async (error) => {
		console.error(error);
		await db.$disconnect();
		process.exit(1);
	});
