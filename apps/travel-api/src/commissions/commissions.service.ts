import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	type AgencyRole,
	canManageCommission,
	canSeeMargins,
} from "@travel/auth";
import { agencyDb, type Db, Prisma } from "@travel/db";
import type { CommissionBasis } from "@travel/db/enums";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { requireAgencyMember, runBulk } from "../travel/bulk";
import {
	countsByKey,
	type ListResult,
	type OrderByColumns,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	CommissionListInput,
	CommissionRow,
	CreateCommissionInput,
	UpdateCommissionInput,
} from "./commissions.contracts";

const SORTABLE: OrderByColumns<Prisma.CommissionOrderByWithRelationInput> = {
	createdAt: (dir) => ({ createdAt: dir }),
	status: (dir) => ({ status: dir }),
	amountBase: (dir) => ({ amountBase: { sort: dir, nulls: "last" } }),
};

const ROW_SELECT = {
	id: true,
	bookingId: true,
	userId: true,
	basis: true,
	rate: true,
	basisBaseAmount: true,
	amount: true,
	currency: true,
	amountBase: true,
	baseCurrency: true,
	status: true,
	approvedAt: true,
	paidAt: true,
	note: true,
	createdAt: true,
	updatedAt: true,
	booking: { select: { folio: true } },
	user: { select: { name: true } },
} as const;

type RawRow = Prisma.CommissionGetPayload<{ select: typeof ROW_SELECT }>;

type BookingTotals = {
	sellTotalBase: Prisma.Decimal | null;
	costTotalBase: Prisma.Decimal | null;
	baseCurrency: string | null;
};

type FrozenFields = {
	rate: Prisma.Decimal | null;
	basisBaseAmount: Prisma.Decimal | null;
	amount: Prisma.Decimal | null;
	currency: string | null;
	amountBase: Prisma.Decimal | null;
	baseCurrency: string | null;
	fxRate: Prisma.Decimal | null;
	fxRateAt: Date | null;
};

function num(value: Prisma.Decimal | null): number | null {
	return value === null ? null : value.toNumber();
}

function toDecimal(value: number | null): Prisma.Decimal | null {
	return value === null ? null : new Prisma.Decimal(value);
}

@Injectable()
export class CommissionsService {
	private readonly logger = new Logger(CommissionsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async list(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		input: CommissionListInput,
	): Promise<ListResult<CommissionRow> & { missingRate: number }> {
		const scoped = agencyDb(this.db, agencyId);
		const viewerScope = canSeeMargins(role) ? null : viewerId;
		const where = this.buildWhere(input, viewerScope);
		const { skip, take } = paginate(input);

		const [rows, total, missingRate, facetCounts] = await Promise.all([
			scoped.commission.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "desc" }),
				select: ROW_SELECT,
			}),
			scoped.commission.count({ where }),
			scoped.commission.count({ where: { ...where, amountBase: null } }),
			this.facetCounts(agencyId, input, viewerScope),
		]);

		return {
			rows: rows.map((row) => this.serialize(row)),
			total,
			facetCounts,
			missingRate,
		};
	}

	async byBooking(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		bookingId: string,
	) {
		const scoped = agencyDb(this.db, agencyId);
		const seeMargins = canSeeMargins(role);

		const booking = await scoped.booking.findFirst({
			where: { id: bookingId },
			select: {
				id: true,
				sellTotalBase: true,
				costTotalBase: true,
				baseCurrency: true,
			},
		});
		if (!booking) {
			throw new NotFoundException("That booking does not exist.");
		}

		const where: Prisma.CommissionWhereInput = { bookingId };
		if (!seeMargins) where.userId = viewerId;

		const rows = await scoped.commission.findMany({
			where,
			orderBy: { createdAt: "desc" },
			select: ROW_SELECT,
		});

		const sell = num(booking.sellTotalBase);
		const cost = num(booking.costTotalBase);

		return {
			rows: rows.map((row) => this.serialize(row)),
			bookingMarginBase:
				seeMargins && sell !== null && cost !== null ? sell - cost : null,
			baseCurrency: booking.baseCurrency,
		};
	}

	async create(
		agencyId: string,
		role: AgencyRole,
		actorId: string,
		input: CreateCommissionInput,
	) {
		this.requireManager(role);
		const scoped = agencyDb(this.db, agencyId);

		const booking = await this.requireBookingTotals(scoped, input.bookingId);
		await requireAgencyMember(this.db, agencyId, input.userId);

		const frozen = await this.freeze(
			agencyId,
			input.basis,
			toDecimal(input.rate),
			toDecimal(input.amount),
			input.currency,
			booking,
		);

		const row = await scoped.commission.create({
			data: {
				agencyId,
				bookingId: input.bookingId,
				userId: input.userId,
				createdById: actorId,
				basis: input.basis,
				note: input.note,
				...frozen,
			},
			select: { id: true, status: true },
		});

		this.logger.log({
			message: "Commission created",
			agencyId,
			commissionId: row.id,
		});

		return { id: row.id, status: row.status };
	}

	async update(
		agencyId: string,
		role: AgencyRole,
		input: UpdateCommissionInput,
	) {
		this.requireManager(role);
		const scoped = agencyDb(this.db, agencyId);

		const current = await scoped.commission.findFirst({
			where: { id: input.id },
			select: {
				id: true,
				status: true,
				basis: true,
				bookingId: true,
				rate: true,
				amount: true,
				currency: true,
			},
		});
		if (!current) {
			throw new NotFoundException("That commission does not exist.");
		}
		if (current.status === "PAID" || current.status === "VOID") {
			throw new BadRequestException(
				"A paid or void commission cannot be changed.",
			);
		}

		const nextRate =
			input.rate !== undefined ? toDecimal(input.rate) : current.rate;
		const nextAmount =
			input.amount !== undefined ? toDecimal(input.amount) : current.amount;
		const nextCurrency =
			input.currency !== undefined ? input.currency : current.currency;

		const booking = await this.requireBookingTotals(scoped, current.bookingId);
		const frozen = await this.freeze(
			agencyId,
			current.basis,
			nextRate,
			nextAmount,
			nextCurrency,
			booking,
		);

		await scoped.commission.update({
			where: { id: input.id },
			data: {
				...(input.note !== undefined && { note: input.note }),
				...frozen,
			},
		});

		return this.rowById(scoped, input.id);
	}

	async approve(agencyId: string, role: AgencyRole, id: string) {
		return this.advance(agencyId, role, id, {
			from: ["PENDING"],
			to: "APPROVED",
			stamp: { approvedAt: new Date() },
			blocked: "Only a pending commission can be approved.",
		});
	}

	async markPaid(agencyId: string, role: AgencyRole, id: string) {
		return this.advance(agencyId, role, id, {
			from: ["APPROVED"],
			to: "PAID",
			stamp: { paidAt: new Date() },
			blocked: "Only an approved commission can be marked paid.",
		});
	}

	async voidCommission(agencyId: string, role: AgencyRole, id: string) {
		this.requireManager(role);
		const scoped = agencyDb(this.db, agencyId);
		try {
			const row = await scoped.commission.update({
				where: { id },
				data: { status: "VOID" },
				select: { id: true, status: true },
			});
			return { id: row.id, status: row.status };
		} catch (cause) {
			this.translate(cause);
		}
	}

	async remove(agencyId: string, role: AgencyRole, id: string) {
		this.requireManager(role);
		const scoped = agencyDb(this.db, agencyId);
		const current = await scoped.commission.findFirst({
			where: { id },
			select: { status: true },
		});
		if (!current) {
			throw new NotFoundException("That commission does not exist.");
		}
		if (current.status === "PAID") {
			throw new BadRequestException(
				"Void a paid commission; do not delete it.",
			);
		}
		await scoped.commission.delete({ where: { id } });
		return { id };
	}

	async recalculate(agencyId: string, role: AgencyRole, id: string) {
		this.requireManager(role);
		const scoped = agencyDb(this.db, agencyId);

		const current = await scoped.commission.findFirst({
			where: { id },
			select: {
				id: true,
				status: true,
				basis: true,
				bookingId: true,
				rate: true,
				amount: true,
				currency: true,
			},
		});
		if (!current) {
			throw new NotFoundException("That commission does not exist.");
		}
		if (current.status === "PAID" || current.status === "VOID") {
			throw new BadRequestException(
				"A paid or void commission cannot be recalculated.",
			);
		}

		const booking = await this.requireBookingTotals(scoped, current.bookingId);
		const frozen = await this.freeze(
			agencyId,
			current.basis,
			current.rate,
			current.amount,
			current.currency,
			booking,
		);

		await scoped.commission.update({ where: { id }, data: frozen });

		return this.rowById(scoped, id);
	}

	async bulkApprove(agencyId: string, role: AgencyRole, ids: string[]) {
		return runBulk(ids, (id) => this.approve(agencyId, role, id));
	}

	async bulkMarkPaid(agencyId: string, role: AgencyRole, ids: string[]) {
		return runBulk(ids, (id) => this.markPaid(agencyId, role, id));
	}

	async byAdvisor(agencyId: string, role: AgencyRole, viewerId: string) {
		const scoped = agencyDb(this.db, agencyId);
		const seeMargins = canSeeMargins(role);

		const earnerWhere: Prisma.CommissionWhereInput = {
			status: { not: "VOID" },
		};
		if (!seeMargins) earnerWhere.userId = viewerId;

		const [grouped, missing, baseCurrency] = await Promise.all([
			scoped.commission.groupBy({
				by: ["userId"],
				where: earnerWhere,
				_sum: { amountBase: true },
				_count: { _all: true },
			}),
			scoped.commission.groupBy({
				by: ["userId"],
				where: { ...earnerWhere, amountBase: null },
				_count: { _all: true },
			}),
			this.conversion.baseCurrencyFor(agencyId),
		]);

		const userIds = grouped.map((group) => group.userId);
		const missingByUser = new Map(
			missing.map((group) => [group.userId, group._count._all]),
		);

		const members = await this.db.member.findMany({
			where: { organizationId: agencyId, userId: { in: userIds } },
			select: { userId: true, user: { select: { name: true } } },
		});
		const nameByUser = new Map(
			members.map((member) => [member.userId, member.user.name]),
		);

		const bookingAgg = seeMargins
			? await scoped.booking.groupBy({
					by: ["ownerId"],
					where: {
						ownerId: { in: userIds },
						archivedAt: null,
						status: { not: "CANCELLED" },
					},
					_sum: { sellTotalBase: true, costTotalBase: true },
					_count: { _all: true },
				})
			: [];
		const bookingByOwner = new Map(
			bookingAgg.map((group) => [group.ownerId, group]),
		);

		return {
			baseCurrency,
			rows: grouped.map((group) => {
				const bookings = bookingByOwner.get(group.userId);
				const sell = bookings ? num(bookings._sum.sellTotalBase) : null;
				const cost = bookings ? num(bookings._sum.costTotalBase) : null;
				return {
					userId: group.userId,
					userName: nameByUser.get(group.userId) ?? "—",
					commissions: group._count._all,
					commissionBase: num(group._sum.amountBase) ?? 0,
					missingRate: missingByUser.get(group.userId) ?? 0,
					bookings: bookings?._count._all ?? 0,
					sellBase: seeMargins ? sell : null,
					marginBase:
						seeMargins && sell !== null && cost !== null ? sell - cost : null,
				};
			}),
		};
	}

	async bySupplier(agencyId: string, role: AgencyRole) {
		if (!canSeeMargins(role)) {
			throw new ForbiddenException(
				"Only an admin or an accountant can see the supplier report.",
			);
		}
		const scoped = agencyDb(this.db, agencyId);

		const [grouped, baseCurrency] = await Promise.all([
			scoped.bookingItem.groupBy({
				by: ["supplierId"],
				where: { supplierId: { not: null } },
				_sum: { costBaseAmount: true, sellBaseAmount: true },
				_count: { _all: true },
			}),
			this.conversion.baseCurrencyFor(agencyId),
		]);

		const supplierIds = grouped
			.map((group) => group.supplierId)
			.filter((id): id is string => id !== null);

		const suppliers = await scoped.supplier.findMany({
			where: { id: { in: supplierIds } },
			select: { id: true, name: true, defaultCommissionRate: true },
		});
		const byId = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

		return {
			baseCurrency,
			rows: grouped
				.filter((group) => group.supplierId !== null)
				.map((group) => {
					const supplier = byId.get(group.supplierId as string);
					return {
						supplierId: group.supplierId as string,
						supplierName: supplier?.name ?? "—",
						items: group._count._all,
						costBase: num(group._sum.costBaseAmount) ?? 0,
						sellBase: num(group._sum.sellBaseAmount) ?? 0,
						defaultRate: supplier ? num(supplier.defaultCommissionRate) : null,
					};
				}),
		};
	}

	private async advance(
		agencyId: string,
		role: AgencyRole,
		id: string,
		step: {
			from: Array<"PENDING" | "APPROVED" | "PAID" | "VOID">;
			to: "APPROVED" | "PAID";
			stamp: { approvedAt?: Date; paidAt?: Date };
			blocked: string;
		},
	) {
		this.requireManager(role);
		const scoped = agencyDb(this.db, agencyId);

		const current = await scoped.commission.findFirst({
			where: { id },
			select: { status: true },
		});
		if (!current) {
			throw new NotFoundException("That commission does not exist.");
		}
		if (!step.from.includes(current.status)) {
			throw new BadRequestException(step.blocked);
		}

		const row = await scoped.commission.update({
			where: { id },
			data: { status: step.to, ...step.stamp },
			select: { id: true, status: true },
		});
		return { id: row.id, status: row.status };
	}

	private async freeze(
		agencyId: string,
		basis: CommissionBasis,
		rate: Prisma.Decimal | null,
		amount: Prisma.Decimal | null,
		currency: string | null,
		booking: BookingTotals,
	): Promise<FrozenFields> {
		if (basis === "FIXED") {
			const fx = await this.conversion.itemFields(
				agencyId,
				amount,
				currency ?? "",
			);
			return {
				rate: null,
				basisBaseAmount: null,
				amount,
				currency,
				amountBase: fx.baseAmount,
				baseCurrency: fx.baseCurrency,
				fxRate: fx.fxRate,
				fxRateAt: fx.fxRateAt,
			};
		}

		const sell = booking.sellTotalBase;
		const cost = booking.costTotalBase;
		const basisBaseAmount =
			basis === "MARGIN"
				? sell !== null && cost !== null
					? sell.sub(cost)
					: null
				: sell;

		const amountBase =
			basisBaseAmount !== null && rate !== null
				? basisBaseAmount.mul(rate).toDecimalPlaces(4)
				: null;

		return {
			rate,
			basisBaseAmount,
			amount: null,
			currency: null,
			amountBase,
			baseCurrency: booking.baseCurrency,
			fxRate: null,
			fxRateAt: null,
		};
	}

	private buildWhere(
		input: CommissionListInput,
		viewerId: string | null,
	): Prisma.CommissionWhereInput {
		const clauses: Prisma.CommissionWhereInput[] = [];

		if (viewerId) clauses.push({ userId: viewerId });
		if (input.userId) clauses.push({ userId: input.userId });
		if (input.bookingId) clauses.push({ bookingId: input.bookingId });
		if (input.status.length > 0) clauses.push({ status: { in: input.status } });
		if (input.basis.length > 0) clauses.push({ basis: { in: input.basis } });

		const term = input.q.trim();
		if (term) {
			clauses.push({
				OR: [
					{ note: { contains: term, mode: "insensitive" } },
					{ booking: { folio: { contains: term, mode: "insensitive" } } },
					{ user: { name: { contains: term, mode: "insensitive" } } },
				],
			});
		}

		return clauses.length > 0 ? { AND: clauses } : {};
	}

	private async facetCounts(
		agencyId: string,
		input: CommissionListInput,
		viewerId: string | null,
	) {
		const scoped = agencyDb(this.db, agencyId);
		const byStatus = await scoped.commission.groupBy({
			by: ["status"],
			where: this.buildWhere({ ...input, status: [] }, viewerId),
			_count: { _all: true },
		});
		const byBasis = await scoped.commission.groupBy({
			by: ["basis"],
			where: this.buildWhere({ ...input, basis: [] }, viewerId),
			_count: { _all: true },
		});

		return {
			status: countsByKey(byStatus, "status"),
			basis: countsByKey(byBasis, "basis"),
		};
	}

	private async requireBookingTotals(
		scoped: ReturnType<typeof agencyDb>,
		bookingId: string,
	): Promise<BookingTotals> {
		const booking = await scoped.booking.findFirst({
			where: { id: bookingId },
			select: { sellTotalBase: true, costTotalBase: true, baseCurrency: true },
		});
		if (!booking) {
			throw new NotFoundException("That booking does not exist.");
		}
		return booking;
	}

	private async rowById(
		scoped: ReturnType<typeof agencyDb>,
		id: string,
	): Promise<CommissionRow> {
		const row = await scoped.commission.findFirst({
			where: { id },
			select: ROW_SELECT,
		});
		if (!row) {
			throw new NotFoundException("That commission does not exist.");
		}
		return this.serialize(row);
	}

	private serialize(row: RawRow): CommissionRow {
		return {
			id: row.id,
			bookingId: row.bookingId,
			bookingFolio: row.booking.folio,
			userId: row.userId,
			userName: row.user.name,
			basis: row.basis,
			rate: num(row.rate),
			basisBaseAmount: num(row.basisBaseAmount),
			amount: num(row.amount),
			currency: row.currency,
			amountBase: num(row.amountBase),
			baseCurrency: row.baseCurrency,
			status: row.status,
			approvedAt: row.approvedAt?.toISOString() ?? null,
			paidAt: row.paidAt?.toISOString() ?? null,
			note: row.note,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private requireManager(role: AgencyRole): void {
		if (!canManageCommission(role)) {
			throw new ForbiddenException(
				"Only an admin or an accountant can change commissions.",
			);
		}
	}

	private translate(cause: unknown): never {
		const code = (cause as { code?: string }).code;
		if (code === "P2025") {
			throw new NotFoundException("That commission does not exist.");
		}
		throw cause;
	}
}
