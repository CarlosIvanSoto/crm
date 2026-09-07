import { db } from "../../src/client";
import { Prisma } from "../../src/generated/prisma/client";
import { GAP_CURRENCY } from "./config";
import type { AgencyBag, SeededBooking } from "./context";
import { withFx } from "./money";
import { daysFromNow, integer, type Rng } from "./random";

const METHODS = ["CASH", "TRANSFER", "CARD", "LINK", "OTHER"] as const;

function sellTotalNumber(booking: SeededBooking): number {
	if (booking.sellTotalBase === null) return 1500;
	return Number(booking.sellTotalBase);
}

export async function seedPayments(bag: AgencyBag, rng: Rng): Promise<void> {
	let methodCursor = 0;

	for (const booking of bag.bookings) {
		if (booking.status === "CANCELLED") continue;
		const total = sellTotalNumber(booking);
		const currency = booking.currency;

		const deposit = Math.round(total * 0.3);
		const depositFx = await withFx(deposit, currency, bag.base);
		await db.payment.create({
			data: {
				agencyId: bag.agencyId,
				bookingId: booking.id,
				dueDate: daysFromNow(-integer(rng, 25, 45)),
				amount: depositFx.amount,
				currency,
				baseAmount: depositFx.baseAmount,
				baseCurrency: depositFx.baseCurrency,
				fxRate: depositFx.fxRate,
				fxRateAt: depositFx.fxRateAt,
				status: "PAID",
				method: METHODS[methodCursor++ % METHODS.length],
				paidAt: daysFromNow(-integer(rng, 18, 40)),
				reference: `REF-${integer(rng, 100000, 999999)}`,
			},
		});

		const balance = Math.round(total * 0.7);
		const balanceFx = await withFx(balance, currency, bag.base);
		const overdue =
			booking.status === "CONFIRMED" && bag.bookings.indexOf(booking) % 2 === 0;
		await db.payment.create({
			data: {
				agencyId: bag.agencyId,
				bookingId: booking.id,
				dueDate: overdue
					? daysFromNow(-integer(rng, 2, 12))
					: daysFromNow(integer(rng, 10, 40)),
				amount: balanceFx.amount,
				currency,
				baseAmount: balanceFx.baseAmount,
				baseCurrency: balanceFx.baseCurrency,
				fxRate: balanceFx.fxRate,
				fxRateAt: balanceFx.fxRateAt,
				status: "SCHEDULED",
			},
		});
	}

	const first = bag.bookings.find((booking) => booking.status === "CONFIRMED");
	if (first) {
		const voidFx = await withFx(120, first.currency, bag.base);
		await db.payment.create({
			data: {
				agencyId: bag.agencyId,
				bookingId: first.id,
				dueDate: daysFromNow(-5),
				amount: voidFx.amount,
				currency: first.currency,
				baseAmount: voidFx.baseAmount,
				baseCurrency: voidFx.baseCurrency,
				fxRate: voidFx.fxRate,
				fxRateAt: voidFx.fxRateAt,
				status: "VOID",
				method: "CARD",
			},
		});

		const gapFx = await withFx(45000, GAP_CURRENCY, bag.base);
		await db.payment.create({
			data: {
				agencyId: bag.agencyId,
				bookingId: first.id,
				dueDate: daysFromNow(-3),
				amount: gapFx.amount,
				currency: GAP_CURRENCY,
				baseAmount: gapFx.baseAmount,
				baseCurrency: gapFx.baseCurrency,
				fxRate: gapFx.fxRate,
				fxRateAt: gapFx.fxRateAt,
				status: "SCHEDULED",
			},
		});
	}
}

export async function seedSupplierPayments(
	bag: AgencyBag,
	rng: Rng,
): Promise<void> {
	for (const booking of bag.bookings) {
		if (booking.status === "CANCELLED" || booking.items.length === 0) continue;

		for (let index = 0; index < Math.min(booking.items.length, 2); index += 1) {
			const item = booking.items[index];
			if (!item?.supplierId) continue;
			const supplier = bag.suppliers.find(
				(entry) => entry.id === item.supplierId,
			);
			const currency = supplier?.currency ?? bag.base;
			const amount = integer(rng, 400, 1800);
			const fx = await withFx(amount, currency, bag.base);
			const paid = index === 0 && booking.status === "COMPLETED";
			const overdue = index === 1 && booking.status === "CONFIRMED";
			await db.supplierPayment.create({
				data: {
					agencyId: bag.agencyId,
					supplierId: item.supplierId,
					bookingId: booking.id,
					bookingItemId: index === 0 ? item.id : null,
					dueDate: overdue
						? daysFromNow(-integer(rng, 2, 10))
						: daysFromNow(integer(rng, 5, 30)),
					amount: fx.amount,
					currency,
					baseAmount: fx.baseAmount,
					baseCurrency: fx.baseCurrency,
					fxRate: fx.fxRate,
					fxRateAt: fx.fxRateAt,
					status: paid ? "PAID" : "SCHEDULED",
					method: paid ? "TRANSFER" : null,
					paidAt: paid ? daysFromNow(-integer(rng, 5, 15)) : null,
				},
			});
		}
	}
}

interface CommissionSpec {
	bookingTag: string;
	basis: "MARGIN" | "SELL" | "FIXED";
	status: "PENDING" | "APPROVED" | "PAID" | "VOID";
	rate?: number;
	amount?: number;
	currency?: string;
	ownerKey: string;
}

const COMMISSION_SPECS: CommissionSpec[] = [
	{
		bookingTag: "fromQuote",
		basis: "MARGIN",
		status: "PENDING",
		rate: 0.1,
		ownerKey: "owner",
	},
	{
		bookingTag: "departs3",
		basis: "MARGIN",
		status: "APPROVED",
		rate: 0.1,
		ownerKey: "agent1",
	},
	{
		bookingTag: "departs9",
		basis: "SELL",
		status: "PENDING",
		rate: 0.05,
		ownerKey: "agent2",
	},
	{
		bookingTag: "departs28",
		basis: "FIXED",
		status: "APPROVED",
		amount: 150,
		ownerKey: "agent1",
	},
	{
		bookingTag: "traveling",
		basis: "FIXED",
		status: "PENDING",
		amount: 20000,
		currency: GAP_CURRENCY,
		ownerKey: "agent2",
	},
	{
		bookingTag: "completed",
		basis: "MARGIN",
		status: "PAID",
		rate: 0.12,
		ownerKey: "owner",
	},
	{
		bookingTag: "cancelled",
		basis: "SELL",
		status: "VOID",
		rate: 0.05,
		ownerKey: "agent1",
	},
	{
		bookingTag: "unpriced",
		basis: "MARGIN",
		status: "PENDING",
		rate: 0.1,
		ownerKey: "agent2",
	},
];

function decimalOrNull(value: string | null): Prisma.Decimal | null {
	return value === null ? null : new Prisma.Decimal(value);
}

export async function seedCommissions(
	bag: AgencyBag,
	rng: Rng,
	bookingsByTag: Map<string, SeededBooking>,
): Promise<void> {
	for (const spec of COMMISSION_SPECS) {
		const booking = bookingsByTag.get(spec.bookingTag);
		if (!booking) continue;
		const earner =
			bag.users.find((user) => user.key === spec.ownerKey) ?? bag.users[0];
		const author =
			bag.users.find((user) => user.role === "admin") ?? bag.users[0];
		if (!earner || !author) continue;

		const sell = decimalOrNull(booking.sellTotalBase);
		const cost = decimalOrNull(booking.costTotalBase);
		const rate =
			spec.rate !== undefined ? new Prisma.Decimal(spec.rate.toFixed(4)) : null;

		let data: Prisma.CommissionUncheckedCreateInput = {
			agencyId: bag.agencyId,
			bookingId: booking.id,
			userId: earner.id,
			createdById: author.id,
			basis: spec.basis,
			status: spec.status,
			note: `Comisión de ${spec.basis} sembrada para ${booking.folio}.`,
			approvedAt:
				spec.status === "APPROVED" || spec.status === "PAID"
					? daysFromNow(-integer(rng, 3, 10))
					: null,
			paidAt: spec.status === "PAID" ? daysFromNow(-integer(rng, 1, 6)) : null,
		};

		if (spec.basis === "FIXED") {
			const currency = spec.currency ?? bag.base;
			const fx = await withFx(spec.amount ?? 0, currency, bag.base);
			data = {
				...data,
				rate: null,
				basisBaseAmount: null,
				amount: fx.amount,
				currency,
				amountBase: fx.baseAmount,
				baseCurrency: fx.baseCurrency,
				fxRate: fx.fxRate,
				fxRateAt: fx.fxRateAt,
			};
		} else {
			const basisBaseAmount =
				spec.basis === "MARGIN"
					? sell !== null && cost !== null
						? sell.sub(cost)
						: null
					: sell;
			const amountBase =
				basisBaseAmount !== null && rate !== null
					? basisBaseAmount.mul(rate).toDecimalPlaces(4)
					: null;
			data = {
				...data,
				rate,
				basisBaseAmount,
				amount: null,
				currency: null,
				amountBase,
				baseCurrency: bag.base,
				fxRate: null,
				fxRateAt: null,
			};
		}

		await db.commission.create({ data });
	}
}
