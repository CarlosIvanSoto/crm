import { db } from "../../src/client";
import { formatFolio } from "../../src/folio";
import type { Prisma } from "../../src/generated/prisma/client";
import type { ItineraryType } from "./catalog";
import { DESTINATIONS, itineraryDetails } from "./catalog";
import { GAP_CURRENCY } from "./config";
import type {
	AgencyBag,
	SeededBooking,
	SeededBookingItem,
	SeededQuote,
} from "./context";
import { itemBaseTotals, itemFx } from "./money";
import { daysFromNow, integer, pick, type Rng, sample } from "./random";

interface BookingItemSpec {
	type: ItineraryType;
	cost: number;
	sell: number;
	currency?: string;
	status: "QUOTED" | "REQUESTED" | "CONFIRMED" | "CANCELLED";
}

interface BookingSpec {
	tag: string;
	status: "DRAFT" | "CONFIRMED" | "TRAVELING" | "COMPLETED" | "CANCELLED";
	startInDays: number | null;
	endInDays: number | null;
	travelers: number;
	thisMonth: boolean;
	archived?: boolean;
	fromQuoteTag?: string;
	items: BookingItemSpec[];
}

function ladder(base: number): BookingItemSpec[] {
	return [
		{
			type: "FLIGHT",
			cost: base,
			sell: Math.round(base * 1.16),
			status: "CONFIRMED",
		},
		{
			type: "HOTEL",
			cost: Math.round(base * 0.8),
			sell: Math.round(base * 1.05),
			status: "CONFIRMED",
		},
		{ type: "TRANSFER", cost: 70, sell: 110, status: "REQUESTED" },
		{ type: "INSURANCE", cost: 45, sell: 80, status: "QUOTED" },
	];
}

const BOOKING_SPECS: BookingSpec[] = [
	{
		tag: "fromQuote",
		status: "CONFIRMED",
		startInDays: 17,
		endInDays: 27,
		travelers: 2,
		thisMonth: true,
		fromQuoteTag: "acceptedWithBooking",
		items: ladder(1200),
	},
	{
		tag: "departs3",
		status: "CONFIRMED",
		startInDays: 3,
		endInDays: 12,
		travelers: 2,
		thisMonth: true,
		items: ladder(900),
	},
	{
		tag: "departs9",
		status: "CONFIRMED",
		startInDays: 9,
		endInDays: 18,
		travelers: 5,
		thisMonth: true,
		items: ladder(1050),
	},
	{
		tag: "departs28",
		status: "CONFIRMED",
		startInDays: 28,
		endInDays: 39,
		travelers: 1,
		thisMonth: true,
		items: ladder(760),
	},
	{
		tag: "departs45",
		status: "CONFIRMED",
		startInDays: 45,
		endInDays: 56,
		travelers: 2,
		thisMonth: false,
		items: ladder(830),
	},
	{
		tag: "traveling",
		status: "TRAVELING",
		startInDays: -4,
		endInDays: 6,
		travelers: 2,
		thisMonth: false,
		items: ladder(1400),
	},
	{
		tag: "completed",
		status: "COMPLETED",
		startInDays: -30,
		endInDays: -20,
		travelers: 3,
		thisMonth: false,
		items: ladder(1150),
	},
	{
		tag: "cancelled",
		status: "CANCELLED",
		startInDays: 20,
		endInDays: 30,
		travelers: 1,
		thisMonth: true,
		items: ladder(700),
	},
	{
		tag: "archivedBooking",
		status: "DRAFT",
		startInDays: 60,
		endInDays: 70,
		travelers: 1,
		thisMonth: false,
		archived: true,
		items: ladder(650),
	},
	{
		tag: "unpriced",
		status: "CONFIRMED",
		startInDays: 22,
		endInDays: 33,
		travelers: 2,
		thisMonth: false,
		items: [
			{ type: "PACKAGE", cost: 1900, sell: 2400, status: "CONFIRMED" },
			{
				type: "TOUR",
				cost: 90000,
				sell: 120000,
				currency: GAP_CURRENCY,
				status: "REQUESTED",
			},
		],
	},
];

type BaseAmounts = {
	sellBaseAmount: Prisma.Decimal | null;
	costBaseAmount: Prisma.Decimal | null;
};

export async function seedBookings(
	bag: AgencyBag,
	rng: Rng,
	quotesByTag: Map<string, SeededQuote>,
): Promise<Map<string, SeededBooking>> {
	const byTag = new Map<string, SeededBooking>();
	const owners = bag.users.filter(
		(user) => user.role === "owner" || user.role === "agent",
	);
	const year = new Date().getFullYear();
	let ownerCursor = 0;

	for (const spec of BOOKING_SPECS) {
		const linkedQuote = spec.fromQuoteTag
			? quotesByTag.get(spec.fromQuoteTag)
			: undefined;
		const ownerId =
			linkedQuote?.ownerId ?? owners[ownerCursor++ % owners.length]?.id ?? null;
		const customerId =
			linkedQuote?.customerId ??
			pick(
				rng,
				bag.customers.filter((entry) => !entry.archived),
			).id;
		const currency = linkedQuote?.currency ?? bag.base;

		bag.bookingSeq += 1;
		const folio = formatFolio(bag.spec.bookingPrefix, year, bag.bookingSeq);
		const createdAt = spec.thisMonth
			? daysFromNow(-integer(rng, 0, 3))
			: daysFromNow(-integer(rng, 35, 80));

		const booking = await db.booking.create({
			data: {
				agencyId: bag.agencyId,
				folio,
				customerId,
				ownerId,
				quoteId: linkedQuote?.id ?? null,
				status: spec.status,
				destination: pick(rng, DESTINATIONS),
				currency,
				travelStartDate:
					spec.startInDays === null ? null : daysFromNow(spec.startInDays),
				travelEndDate:
					spec.endInDays === null ? null : daysFromNow(spec.endInDays),
				createdAt,
				lastActivityAt: daysFromNow(-integer(rng, 1, 40)),
				archivedAt: spec.archived ? daysFromNow(-integer(rng, 5, 20)) : null,
			},
		});

		const items: SeededBookingItem[] = [];
		const built: BaseAmounts[] = [];

		for (let index = 0; index < spec.items.length; index += 1) {
			const itemSpec = spec.items[index] as BookingItemSpec;
			const itemCurrency = itemSpec.currency ?? currency;
			const fx = await itemFx(
				{
					costAmount: itemSpec.cost,
					costCurrency: itemCurrency,
					sellAmount: itemSpec.sell,
					sellCurrency: itemCurrency,
				},
				bag.base,
			);
			const supplier = pick(
				rng,
				bag.suppliers.filter((entry) => !entry.archived),
			);
			const created = await db.bookingItem.create({
				data: {
					agencyId: bag.agencyId,
					bookingId: booking.id,
					type: itemSpec.type,
					status: itemSpec.status,
					supplierId: supplier.id,
					confirmationCode:
						itemSpec.status === "CONFIRMED"
							? `CNF-${integer(rng, 10000, 99999)}`
							: null,
					position: index,
					paxCount: spec.travelers,
					startLocation: "Origen",
					endLocation: "Destino",
					startsAt:
						spec.startInDays === null ? null : daysFromNow(spec.startInDays),
					endsAt: spec.endInDays === null ? null : daysFromNow(spec.endInDays),
					costAmount: fx.costAmount,
					costCurrency: fx.costCurrency,
					sellAmount: fx.sellAmount,
					sellCurrency: fx.sellCurrency,
					costBaseAmount: fx.costBaseAmount,
					sellBaseAmount: fx.sellBaseAmount,
					baseCurrency: fx.baseCurrency,
					fxRate: fx.fxRate,
					fxRateAt: fx.fxRateAt,
					details: itineraryDetails(rng, itemSpec.type),
				},
			});
			items.push({
				id: created.id,
				supplierId: supplier.id,
				sellAmount: fx.sellAmount?.toString() ?? null,
				sellCurrency: fx.sellCurrency,
			});
			built.push({
				sellBaseAmount: fx.sellBaseAmount,
				costBaseAmount: fx.costBaseAmount,
			});
		}

		const totals = itemBaseTotals(built);
		await db.booking.update({
			where: { id: booking.id },
			data: {
				sellTotalBase: totals.sell,
				costTotalBase: totals.cost,
				baseCurrency: bag.base,
			},
		});

		const pinnedTraveler =
			spec.tag === "departs9" ? (bag.travelers[0]?.id as string) : null;
		const pool = bag.travelers.filter((entry) => entry.id !== pinnedTraveler);
		const chosen = sample(
			rng,
			pool,
			Math.max(spec.travelers - (pinnedTraveler ? 1 : 0), 0),
		);
		const travelerIds = pinnedTraveler
			? [pinnedTraveler, ...chosen.map((entry) => entry.id)]
			: chosen.map((entry) => entry.id);

		for (let index = 0; index < travelerIds.length; index += 1) {
			await db.bookingTraveler.create({
				data: {
					agencyId: bag.agencyId,
					bookingId: booking.id,
					travelerId: travelerIds[index] as string,
					isLead: index === 0,
					paxType:
						index === 0
							? "ADULT"
							: pick(rng, ["ADULT", "ADULT", "CHILD", "INFANT"]),
				},
			});
		}

		const seeded: SeededBooking = {
			id: booking.id,
			folio,
			status: spec.status,
			ownerId,
			customerId,
			currency,
			baseCurrency: bag.base,
			sellTotalBase: totals.sell?.toString() ?? null,
			costTotalBase: totals.cost?.toString() ?? null,
			travelStartDate: booking.travelStartDate,
			items,
			travelerIds,
			fromQuoteId: linkedQuote?.id ?? null,
		};
		bag.bookings.push(seeded);
		byTag.set(spec.tag, seeded);
	}

	return byTag;
}
