import { Injectable } from "@nestjs/common";
import { type AgencyRole, canSeeMargins } from "@travel/auth";
import { agencyDb, type Db, type Prisma } from "@travel/db";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import type { DashboardSummaryInput } from "./dashboard.contracts";

const DEPARTURE_WINDOW_DAYS = 30;
const DEPARTURE_LIMIT = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

function monthStart(from: Date, offset: number): Date {
	return new Date(from.getFullYear(), from.getMonth() + offset, 1);
}

@Injectable()
export class DashboardService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async summary(
		agencyId: string,
		role: AgencyRole,
		userId: string,
		input: DashboardSummaryInput,
	) {
		const scoped = agencyDb(this.db, agencyId);
		const mine = input.scope === "me";
		const owned = mine ? { ownerId: userId } : {};

		const now = new Date();
		const startOfMonth = monthStart(now, 0);
		const startOfNextMonth = monthStart(now, 1);
		const departureEnd = new Date(
			now.getTime() + DEPARTURE_WINDOW_DAYS * DAY_MS,
		);

		const liveBooking = {
			...owned,
			archivedAt: null,
			status: { not: "CANCELLED" as const },
		};

		const overdueWhere: Prisma.PaymentWhereInput = {
			status: "SCHEDULED",
			dueDate: { lt: now },
		};
		if (mine) overdueWhere.booking = { ownerId: userId };

		const [monthAgg, overdueRows, departureRows, unconverted, baseCurrency] =
			await Promise.all([
				scoped.booking.aggregate({
					where: {
						...liveBooking,
						createdAt: { gte: startOfMonth, lt: startOfNextMonth },
					},
					_sum: { sellTotalBase: true, costTotalBase: true },
					_count: { _all: true },
				}),
				scoped.payment.findMany({
					where: overdueWhere,
					select: { baseAmount: true },
				}),
				scoped.booking.findMany({
					where: {
						...liveBooking,
						travelStartDate: { gte: now, lt: departureEnd },
					},
					orderBy: { travelStartDate: "asc" },
					select: {
						id: true,
						folio: true,
						destination: true,
						travelStartDate: true,
						status: true,
						customer: { select: { name: true } },
						_count: { select: { travelers: true } },
					},
				}),
				this.conversion.unconverted(agencyId),
				this.conversion.baseCurrencyFor(agencyId),
			]);

		const soldBase = monthAgg._sum.sellTotalBase?.toNumber() ?? 0;
		const costBase = monthAgg._sum.costTotalBase?.toNumber() ?? 0;

		let overdueAmountBase = 0;
		let overdueMissingRate = 0;
		for (const row of overdueRows) {
			if (row.baseAmount === null) {
				overdueMissingRate += 1;
				continue;
			}
			overdueAmountBase += row.baseAmount.toNumber();
		}

		return {
			scope: input.scope,
			baseCurrency,
			month: {
				soldBase,
				costBase,
				marginBase: canSeeMargins(role) ? soldBase - costBase : null,
				bookings: monthAgg._count._all,
			},
			overdue: {
				amountBase: overdueAmountBase,
				count: overdueRows.length,
				missingRate: overdueMissingRate,
			},
			departures: {
				windowDays: DEPARTURE_WINDOW_DAYS,
				count: departureRows.length,
				items: departureRows.slice(0, DEPARTURE_LIMIT).map((row) => ({
					id: row.id,
					folio: row.folio,
					customerName: row.customer.name,
					destination: row.destination,
					travelStartDate: row.travelStartDate?.toISOString() ?? "",
					travelers: row._count.travelers,
					status: row.status,
				})),
			},
			unconverted,
		};
	}
}
