import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	agencyDb,
	COUNTER_KIND,
	type Db,
	formatFolio,
	nextCounter,
	type Prisma,
} from "@travel/db";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { requireAgencyMember, runBulk } from "../travel/bulk";
import {
	buildItineraryItemData,
	type ItineraryItemInput,
	itemBaseTotals,
} from "../travel/itinerary";
import { blankToNull } from "../travel/values";
import {
	archivedFilter,
	countsByKey,
	type ListResult,
	type OrderByColumns,
	ownerFilter,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	BookingCreateInput,
	BookingListInput,
	BookingRow,
} from "./bookings.contracts";

type TravelerInput = {
	firstName: string;
	lastName: string;
	dateOfBirth: string | null;
	nationality: string | null;
	documentType: Prisma.TravelerCreateInput["documentType"] | null;
	documentNumber: string | null;
	documentExpiresAt: string | null;
	paxType: Prisma.BookingTravelerCreateInput["paxType"];
	isLead: boolean;
};

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const SORTABLE: OrderByColumns<Prisma.BookingOrderByWithRelationInput> = {
	folio: (dir) => ({ folio: dir }),
	status: (dir) => ({ status: dir }),
	createdAt: (dir) => ({ createdAt: dir }),
	customer: (dir) => ({ customer: { name: dir } }),
	owner: (dir) => ({ owner: { name: dir } }),
	travelStartDate: (dir) => ({ travelStartDate: { sort: dir, nulls: "last" } }),
	lastActivity: (dir) => ({ lastActivityAt: { sort: dir, nulls: "last" } }),
	archivedAt: (dir) => ({ archivedAt: { sort: dir, nulls: "last" } }),
};

function num(value: Prisma.Decimal | null): number | null {
	return value === null ? null : value.toNumber();
}

@Injectable()
export class BookingsService {
	private readonly logger = new Logger(BookingsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async list(
		agencyId: string,
		input: BookingListInput,
	): Promise<ListResult<BookingRow>> {
		const scoped = agencyDb(this.db, agencyId);
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			scoped.booking.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "desc" }),
				select: {
					id: true,
					folio: true,
					status: true,
					customer: { select: { id: true, name: true } },
					owner: { select: OWNER_SELECT },
					destination: true,
					currency: true,
					travelStartDate: true,
					sellTotalBase: true,
					costTotalBase: true,
					baseCurrency: true,
					_count: { select: { items: true, travelers: true } },
					lastActivityAt: true,
					createdAt: true,
					archivedAt: true,
				},
			}),
			scoped.booking.count({ where }),
			this.facetCounts(agencyId, input),
		]);

		return {
			rows: rows.map((row) => {
				const sell = num(row.sellTotalBase);
				const cost = num(row.costTotalBase);
				return {
					id: row.id,
					folio: row.folio,
					status: row.status,
					customer: row.customer,
					owner: row.owner,
					destination: row.destination,
					currency: row.currency,
					travelStartDate: row.travelStartDate?.toISOString() ?? null,
					sellTotalBase: sell,
					costTotalBase: cost,
					marginBase: sell !== null && cost !== null ? sell - cost : null,
					baseCurrency: row.baseCurrency,
					itemCount: row._count.items,
					travelerCount: row._count.travelers,
					lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
					createdAt: row.createdAt.toISOString(),
					archivedAt: row.archivedAt?.toISOString() ?? null,
				};
			}),
			total,
			facetCounts,
		};
	}

	async byId(agencyId: string, id: string) {
		const scoped = agencyDb(this.db, agencyId);
		const booking = await scoped.booking.findFirst({
			where: { id },
			select: {
				id: true,
				folio: true,
				status: true,
				customer: { select: { id: true, name: true } },
				owner: { select: OWNER_SELECT },
				ownerId: true,
				quoteId: true,
				destination: true,
				currency: true,
				travelStartDate: true,
				travelEndDate: true,
				sellTotalBase: true,
				costTotalBase: true,
				baseCurrency: true,
				lastActivityAt: true,
				createdAt: true,
				updatedAt: true,
				archivedAt: true,
				items: {
					orderBy: { position: "asc" },
					select: {
						id: true,
						type: true,
						status: true,
						supplierId: true,
						description: true,
						confirmationCode: true,
						startsAt: true,
						endsAt: true,
						paxCount: true,
						position: true,
						costAmount: true,
						costCurrency: true,
						sellAmount: true,
						sellCurrency: true,
						sellBaseAmount: true,
						costBaseAmount: true,
						baseCurrency: true,
						details: true,
					},
				},
				travelers: {
					select: {
						id: true,
						travelerId: true,
						paxType: true,
						isLead: true,
						traveler: {
							select: {
								firstName: true,
								lastName: true,
								documentNumber: true,
								documentExpiresAt: true,
							},
						},
					},
				},
			},
		});

		if (!booking) {
			throw new NotFoundException("That booking does not exist.");
		}

		const sell = num(booking.sellTotalBase);
		const cost = num(booking.costTotalBase);
		const unpriced = booking.items.filter(
			(item) => item.sellBaseAmount === null || item.costBaseAmount === null,
		).length;

		return {
			id: booking.id,
			folio: booking.folio,
			status: booking.status,
			customer: booking.customer,
			owner: booking.owner,
			ownerId: booking.ownerId,
			quoteId: booking.quoteId,
			destination: booking.destination,
			currency: booking.currency,
			travelStartDate: booking.travelStartDate?.toISOString() ?? null,
			travelEndDate: booking.travelEndDate?.toISOString() ?? null,
			sellTotalBase: sell,
			costTotalBase: cost,
			marginBase: sell !== null && cost !== null ? sell - cost : null,
			baseCurrency: booking.baseCurrency,
			itemCount: booking.items.length,
			travelerCount: booking.travelers.length,
			unpricedItems: unpriced,
			lastActivityAt: booking.lastActivityAt?.toISOString() ?? null,
			createdAt: booking.createdAt.toISOString(),
			updatedAt: booking.updatedAt.toISOString(),
			archivedAt: booking.archivedAt?.toISOString() ?? null,
			items: booking.items.map((item) => ({
				id: item.id,
				type: item.type,
				status: item.status,
				supplierId: item.supplierId,
				description: item.description,
				confirmationCode: item.confirmationCode,
				startsAt: item.startsAt?.toISOString() ?? null,
				endsAt: item.endsAt?.toISOString() ?? null,
				paxCount: item.paxCount,
				position: item.position,
				costAmount: num(item.costAmount),
				costCurrency: item.costCurrency,
				sellAmount: num(item.sellAmount),
				sellCurrency: item.sellCurrency,
				sellBaseAmount: num(item.sellBaseAmount),
				costBaseAmount: num(item.costBaseAmount),
				baseCurrency: item.baseCurrency,
				details: item.details,
			})),
			travelers: booking.travelers.map((link) => ({
				id: link.id,
				travelerId: link.travelerId,
				firstName: link.traveler.firstName,
				lastName: link.traveler.lastName,
				paxType: link.paxType,
				isLead: link.isLead,
				documentNumber: link.traveler.documentNumber,
				documentExpiresAt:
					link.traveler.documentExpiresAt?.toISOString() ?? null,
			})),
		};
	}

	async create(agencyId: string, input: BookingCreateInput) {
		await this.requireCustomer(agencyId, input.customerId);
		await requireAgencyMember(this.db, agencyId, input.ownerId);

		const settings = await this.settings(agencyId);

		const booking = await this.db.$transaction(async (tx) => {
			const value = await nextCounter(tx, agencyId, COUNTER_KIND.booking);
			const folio = formatFolio(
				settings.bookingPrefix,
				new Date().getFullYear(),
				value,
			);

			return tx.booking.create({
				data: {
					agencyId,
					folio,
					customerId: input.customerId,
					ownerId: input.ownerId,
					status: "DRAFT",
					destination: input.destination
						? blankToNull(input.destination)
						: null,
					currency: input.currency.trim().toUpperCase(),
					travelStartDate: input.travelStartDate
						? new Date(input.travelStartDate)
						: null,
					travelEndDate: input.travelEndDate
						? new Date(input.travelEndDate)
						: null,
				},
				select: { id: true, folio: true },
			});
		});

		this.logger.log({
			message: "Booking created",
			agencyId,
			bookingId: booking.id,
			folio: booking.folio,
		});

		return booking;
	}

	async update(
		agencyId: string,
		id: string,
		data: Partial<BookingCreateInput> & { status?: string },
	) {
		const scoped = agencyDb(this.db, agencyId);
		const current = await scoped.booking.findFirst({
			where: { id },
			select: { id: true },
		});
		if (!current) {
			throw new NotFoundException("That booking does not exist.");
		}

		if (data.customerId !== undefined) {
			await this.requireCustomer(agencyId, data.customerId);
		}
		if (data.ownerId !== undefined) {
			await requireAgencyMember(this.db, agencyId, data.ownerId);
		}

		const patch: Prisma.BookingUpdateInput = {};
		if (data.customerId !== undefined) {
			patch.customer = { connect: { id: data.customerId } };
		}
		if (data.ownerId !== undefined) {
			patch.owner = data.ownerId
				? { connect: { id: data.ownerId } }
				: { disconnect: true };
		}
		if (data.destination !== undefined) {
			patch.destination = data.destination
				? blankToNull(data.destination)
				: null;
		}
		if (data.currency !== undefined) {
			patch.currency = data.currency.trim().toUpperCase();
		}
		if (data.travelStartDate !== undefined) {
			patch.travelStartDate = data.travelStartDate
				? new Date(data.travelStartDate)
				: null;
		}
		if (data.travelEndDate !== undefined) {
			patch.travelEndDate = data.travelEndDate
				? new Date(data.travelEndDate)
				: null;
		}
		if (data.status !== undefined) {
			patch.status = data.status as Prisma.BookingUpdateInput["status"];
		}

		try {
			return await scoped.booking.update({
				where: { id },
				data: patch,
				select: { id: true, folio: true },
			});
		} catch (cause) {
			this.translate(cause);
		}
	}

	async setItems(agencyId: string, id: string, items: ItineraryItemInput[]) {
		const scoped = agencyDb(this.db, agencyId);
		const booking = await scoped.booking.findFirst({
			where: { id },
			select: { id: true },
		});
		if (!booking) {
			throw new NotFoundException("That booking does not exist.");
		}

		const built = await Promise.all(
			items.map((item) =>
				buildItineraryItemData(agencyId, this.conversion, item),
			),
		);

		const totals = itemBaseTotals(built);
		const baseCurrency =
			built[0]?.baseCurrency ??
			(await this.conversion.baseCurrencyFor(agencyId));

		await scoped.$transaction(async (tx) => {
			await tx.bookingItem.deleteMany({ where: { bookingId: id } });

			for (const [index, itemData] of built.entries()) {
				await tx.bookingItem.create({
					data: {
						agencyId,
						bookingId: id,
						...itemData,
						position: itemData.position || index,
					},
				});
			}

			await tx.booking.update({
				where: { id },
				data: {
					sellTotalBase: totals.missing === 0 ? totals.sell : null,
					costTotalBase: totals.missing === 0 ? totals.cost : null,
					baseCurrency,
				},
			});
		});

		this.logger.log({
			message: "Booking items replaced",
			agencyId,
			bookingId: id,
			items: built.length,
		});

		return this.byId(agencyId, id);
	}

	async setTravelers(agencyId: string, id: string, travelers: TravelerInput[]) {
		const scoped = agencyDb(this.db, agencyId);
		const booking = await scoped.booking.findFirst({
			where: { id },
			select: { id: true, customerId: true },
		});
		if (!booking) {
			throw new NotFoundException("That booking does not exist.");
		}

		if (travelers.filter((traveler) => traveler.isLead).length > 1) {
			throw new ConflictException("A booking has one lead traveler.");
		}

		await scoped.$transaction(async (tx) => {
			const links = await tx.bookingTraveler.findMany({
				where: { bookingId: id },
				select: { travelerId: true },
			});
			await tx.bookingTraveler.deleteMany({ where: { bookingId: id } });
			if (links.length > 0) {
				await tx.traveler.deleteMany({
					where: { id: { in: links.map((link) => link.travelerId) } },
				});
			}

			for (const input of travelers) {
				const traveler = await tx.traveler.create({
					data: {
						agencyId,
						customerId: booking.customerId,
						firstName: input.firstName,
						lastName: input.lastName,
						dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
						nationality: input.nationality,
						documentType: input.documentType,
						documentNumber: input.documentNumber,
						documentExpiresAt: input.documentExpiresAt
							? new Date(input.documentExpiresAt)
							: null,
					},
					select: { id: true },
				});

				await tx.bookingTraveler.create({
					data: {
						agencyId,
						bookingId: id,
						travelerId: traveler.id,
						paxType: input.paxType,
						isLead: input.isLead,
					},
				});
			}
		});

		this.logger.log({
			message: "Booking travelers replaced",
			agencyId,
			bookingId: id,
			travelers: travelers.length,
		});

		return this.byId(agencyId, id);
	}

	async archive(agencyId: string, id: string) {
		return this.setArchived(agencyId, id, new Date());
	}

	async restore(agencyId: string, id: string) {
		return this.setArchived(agencyId, id, null);
	}

	async purge(agencyId: string, id: string) {
		const scoped = agencyDb(this.db, agencyId);
		try {
			await scoped.booking.delete({ where: { id } });
			return { id, archivedAt: null };
		} catch (cause) {
			this.translate(cause);
		}
	}

	async bulkArchive(agencyId: string, ids: string[]) {
		return runBulk(ids, (id) => this.archive(agencyId, id));
	}

	async bulkRestore(agencyId: string, ids: string[]) {
		return runBulk(ids, (id) => this.restore(agencyId, id));
	}

	async bulkPurge(agencyId: string, ids: string[]) {
		return runBulk(ids, (id) => this.purge(agencyId, id));
	}

	private async setArchived(
		agencyId: string,
		id: string,
		archivedAt: Date | null,
	) {
		const scoped = agencyDb(this.db, agencyId);
		try {
			const row = await scoped.booking.update({
				where: { id },
				data: { archivedAt },
				select: { id: true, archivedAt: true },
			});
			return { id: row.id, archivedAt: row.archivedAt?.toISOString() ?? null };
		} catch (cause) {
			this.translate(cause);
		}
	}

	private async requireCustomer(agencyId: string, customerId: string) {
		const scoped = agencyDb(this.db, agencyId);
		const customer = await scoped.customer.findFirst({
			where: { id: customerId },
			select: { id: true },
		});
		if (!customer) {
			throw new NotFoundException("That customer does not exist.");
		}
	}

	private async settings(agencyId: string) {
		const scoped = agencyDb(this.db, agencyId);
		const row = await scoped.agencySettings.findFirst({
			where: { agencyId },
			select: { bookingPrefix: true },
		});
		return { bookingPrefix: row?.bookingPrefix ?? "EXP" };
	}

	private buildWhere(input: BookingListInput): Prisma.BookingWhereInput {
		const clauses: Prisma.BookingWhereInput[] = [
			archivedFilter(input.archived),
		];

		const term = input.q.trim();
		if (term) {
			clauses.push({
				OR: [
					{ folio: { contains: term, mode: "insensitive" } },
					{ destination: { contains: term, mode: "insensitive" } },
					{ customer: { name: { contains: term, mode: "insensitive" } } },
				],
			});
		}

		if (input.status.length > 0) {
			clauses.push({ status: { in: input.status } });
		}

		const owner = ownerFilter(input.owner);
		if (owner) {
			clauses.push(owner as Prisma.BookingWhereInput);
		}

		return { AND: clauses };
	}

	private async facetCounts(agencyId: string, input: BookingListInput) {
		const scoped = agencyDb(this.db, agencyId);
		const base = this.buildWhere({ ...input, status: [], owner: [] });

		const [byStatus, byOwner] = await Promise.all([
			scoped.booking.groupBy({
				by: ["status"],
				where: base,
				_count: { _all: true },
			}),
			scoped.booking.groupBy({
				by: ["ownerId"],
				where: base,
				_count: { _all: true },
			}),
		]);

		return {
			status: countsByKey(byStatus, "status"),
			owner: countsByKey(byOwner, "ownerId", "unassigned"),
		};
	}

	private translate(cause: unknown): never {
		const code = (cause as { code?: string }).code;
		if (code === "P2025") {
			throw new NotFoundException("That booking does not exist.");
		}
		if (code === "P2002") {
			throw new ConflictException("That folio is already taken.");
		}
		throw cause;
	}
}
