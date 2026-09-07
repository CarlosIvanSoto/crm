import { db } from "../../src/client";
import { formatFolio } from "../../src/folio";
import type { Prisma } from "../../src/generated/prisma/client";
import type { ItineraryType } from "./catalog";
import { DESTINATIONS, itineraryDetails } from "./catalog";
import { GAP_CURRENCY } from "./config";
import type { AgencyBag, SeededQuote, SeededQuoteOption } from "./context";
import { itemBaseTotals, itemFx } from "./money";
import { daysFromNow, integer, pick, type Rng } from "./random";

type BaseAmounts = {
	sellBaseAmount: Prisma.Decimal | null;
	costBaseAmount: Prisma.Decimal | null;
};

interface ItemSpec {
	type: ItineraryType;
	cost: number;
	sell: number;
	currency?: string;
	status?: "QUOTED" | "REQUESTED" | "CONFIRMED" | "CANCELLED";
}

interface OptionSpec {
	label: string;
	recommended?: boolean;
	items: ItemSpec[];
}

interface QuoteSpec {
	tag: string;
	status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
	owner: "round" | "unassigned" | string;
	currencyMode: "base" | "nonBase";
	options: OptionSpec[];
	validUntilDays?: number;
	sentAtDays?: number;
	decidedDaysAgo?: number;
	archived?: boolean;
	acceptedByName?: string;
}

function trio(base: number): ItemSpec[] {
	return [
		{
			type: "FLIGHT",
			cost: base,
			sell: Math.round(base * 1.18),
			status: "CONFIRMED",
		},
		{
			type: "HOTEL",
			cost: Math.round(base * 0.7),
			sell: Math.round(base * 0.9),
			status: "REQUESTED",
		},
		{ type: "TRANSFER", cost: 60, sell: 90, status: "QUOTED" },
	];
}

const QUOTE_SPECS: QuoteSpec[] = [
	{
		tag: "draftEmpty",
		status: "DRAFT",
		owner: "round",
		currencyMode: "base",
		options: [],
	},
	{
		tag: "draftOne",
		status: "DRAFT",
		owner: "round",
		currencyMode: "base",
		options: [{ label: "Base", items: trio(700) }],
	},
	{
		tag: "agentEligible",
		status: "SENT",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 6,
		options: [
			{ label: "Económica", items: trio(820) },
			{ label: "Cómoda", recommended: true, items: trio(1100) },
		],
	},
	{
		tag: "agentOpenTask",
		status: "SENT",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 9,
		options: [
			{ label: "Económica", items: trio(760) },
			{
				label: "Premium",
				recommended: true,
				items: [
					{ type: "PACKAGE", cost: 2400, sell: 2950, status: "REQUESTED" },
					{ type: "CAR_RENTAL", cost: 210, sell: 320, status: "QUOTED" },
					{ type: "OTHER", cost: 40, sell: 60, status: "QUOTED" },
				],
			},
		],
	},
	{
		tag: "agentIneligible",
		status: "SENT",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 1,
		options: [{ label: "Base", recommended: true, items: trio(640) }],
	},
	{
		tag: "agentThrottled",
		status: "SENT",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 12,
		options: [{ label: "Base", recommended: true, items: trio(880) }],
	},
	{
		tag: "unpricedOption",
		status: "SENT",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 4,
		options: [
			{ label: "Con precio", recommended: true, items: trio(900) },
			{
				label: "Por confirmar",
				items: [
					{ type: "CRUISE", cost: 1800, sell: 2200 },
					{ type: "TOUR", cost: 120000, sell: 150000, currency: GAP_CURRENCY },
				],
			},
		],
	},
	{
		tag: "nonBase",
		status: "SENT",
		owner: "round",
		currencyMode: "nonBase",
		sentAtDays: 8,
		options: [
			{ label: "Estándar", recommended: true, items: trio(1000) },
			{ label: "Superior", items: trio(1450) },
		],
	},
	{
		tag: "acceptedWithBooking",
		status: "ACCEPTED",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 20,
		decidedDaysAgo: 12,
		options: [
			{ label: "Económica", items: trio(950) },
			{ label: "Cómoda", recommended: true, items: trio(1300) },
		],
	},
	{
		tag: "acceptedPublic",
		status: "ACCEPTED",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 15,
		decidedDaysAgo: 3,
		acceptedByName: "Cliente Final",
		options: [
			{ label: "Estándar", recommended: true, items: trio(1050) },
			{ label: "Superior", items: trio(1500) },
		],
	},
	{
		tag: "declined",
		status: "DECLINED",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 18,
		decidedDaysAgo: 6,
		options: [{ label: "Base", recommended: true, items: trio(720) }],
	},
	{
		tag: "expired",
		status: "EXPIRED",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 30,
		validUntilDays: -10,
		options: [{ label: "Base", recommended: true, items: trio(680) }],
	},
	{
		tag: "archived",
		status: "SENT",
		owner: "round",
		currencyMode: "base",
		sentAtDays: 25,
		archived: true,
		options: [{ label: "Base", recommended: true, items: trio(600) }],
	},
	{
		tag: "unassigned",
		status: "SENT",
		owner: "unassigned",
		currencyMode: "base",
		sentAtDays: 5,
		options: [
			{ label: "Económica", items: trio(770) },
			{ label: "Cómoda", recommended: true, items: trio(1020) },
		],
	},
];

export async function seedQuotes(
	bag: AgencyBag,
	rng: Rng,
): Promise<Map<string, SeededQuote>> {
	const byTag = new Map<string, SeededQuote>();
	const owners = bag.users.filter((user) => user.role !== "accountant");
	const year = new Date().getFullYear();
	const nonBase = bag.base === "USD" ? "EUR" : "USD";

	let ownerCursor = 0;

	for (const spec of QUOTE_SPECS) {
		const ownerId =
			spec.owner === "unassigned"
				? null
				: spec.owner === "round"
					? (owners[ownerCursor++ % owners.length]?.id ?? null)
					: (bag.users.find((user) => user.key === spec.owner)?.id ?? null);

		const currency = spec.currencyMode === "nonBase" ? nonBase : bag.base;
		const customer = pick(
			rng,
			bag.customers.filter((entry) => !entry.archived),
		);
		bag.quoteSeq += 1;
		const folio = formatFolio(bag.spec.quotePrefix, year, bag.quoteSeq);
		const sentAt = spec.sentAtDays ? daysFromNow(-spec.sentAtDays) : null;
		const decidedAt = spec.decidedDaysAgo
			? daysFromNow(-spec.decidedDaysAgo)
			: null;

		const quote = await db.quote.create({
			data: {
				agencyId: bag.agencyId,
				folio,
				customerId: customer.id,
				ownerId,
				status: spec.status,
				destination: pick(rng, DESTINATIONS),
				currency,
				paxAdults: integer(rng, 1, 4),
				paxChildren: integer(rng, 0, 2),
				validUntil:
					spec.validUntilDays !== undefined
						? daysFromNow(spec.validUntilDays)
						: sentAt
							? daysFromNow(integer(rng, 3, 20))
							: null,
				notes: "Generado por la semilla de demostración.",
				terms: bag.spec.defaultTerms,
				sentAt,
				decidedAt,
				createdAt: daysFromNow(-integer(rng, 5, 60)),
				archivedAt: spec.archived ? daysFromNow(-integer(rng, 5, 30)) : null,
			},
		});

		const options: SeededQuoteOption[] = [];

		for (
			let optionIndex = 0;
			optionIndex < spec.options.length;
			optionIndex += 1
		) {
			const optionSpec = spec.options[optionIndex] as OptionSpec;
			const option = await db.quoteOption.create({
				data: {
					agencyId: bag.agencyId,
					quoteId: quote.id,
					label: optionSpec.label,
					position: optionIndex,
					isRecommended: optionSpec.recommended ?? false,
				},
			});

			const built: BaseAmounts[] = [];

			for (
				let itemIndex = 0;
				itemIndex < optionSpec.items.length;
				itemIndex += 1
			) {
				const itemSpec = optionSpec.items[itemIndex] as ItemSpec;
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
				await db.quoteItem.create({
					data: {
						agencyId: bag.agencyId,
						quoteOptionId: option.id,
						type: itemSpec.type,
						status: itemSpec.status ?? "QUOTED",
						supplierId: supplier.id,
						position: itemIndex,
						paxCount: integer(rng, 1, 3),
						startLocation: "Origen",
						endLocation: "Destino",
						startsAt: daysFromNow(integer(rng, 20, 90)),
						endsAt: daysFromNow(integer(rng, 91, 110)),
						description: `${itemSpec.type} para la opción ${optionSpec.label}`,
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
				built.push({
					sellBaseAmount: fx.sellBaseAmount,
					costBaseAmount: fx.costBaseAmount,
				});
			}

			const totals = itemBaseTotals(built);
			if (totals.sell !== null && totals.cost !== null) {
				await db.quoteOption.update({
					where: { id: option.id },
					data: {
						sellTotalBase: totals.sell,
						costTotalBase: totals.cost,
						baseCurrency: bag.base,
					},
				});
			}
			options.push({
				id: option.id,
				label: optionSpec.label,
				sellTotalBase: totals.sell?.toString() ?? null,
				costTotalBase: totals.cost?.toString() ?? null,
			});
		}

		if (spec.tag === "acceptedPublic" && options[0]) {
			await db.quote.update({
				where: { id: quote.id },
				data: {
					acceptedOptionId: options[0].id,
					acceptedByName: spec.acceptedByName,
				},
			});
		}

		const seeded: SeededQuote = {
			id: quote.id,
			folio,
			status: spec.status,
			ownerId,
			customerId: customer.id,
			currency,
			validUntil: quote.validUntil,
			sentAt,
			options,
		};
		bag.quotes.push(seeded);
		byTag.set(spec.tag, seeded);
	}

	return byTag;
}
