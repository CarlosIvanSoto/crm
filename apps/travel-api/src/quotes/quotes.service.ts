import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { type AgencyRole, canSeeMargins } from "@travel/auth";
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
	QuoteCreateInput as QuoteCreate,
	QuoteListInput,
	QuoteRow,
} from "./quotes.contracts";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const SORTABLE: OrderByColumns<Prisma.QuoteOrderByWithRelationInput> = {
	folio: (dir) => ({ folio: dir }),
	status: (dir) => ({ status: dir }),
	createdAt: (dir) => ({ createdAt: dir }),
	customer: (dir) => ({ customer: { name: dir } }),
	owner: (dir) => ({ owner: { name: dir } }),
	travelStartDate: (dir) => ({ travelStartDate: { sort: dir, nulls: "last" } }),
	archivedAt: (dir) => ({ archivedAt: { sort: dir, nulls: "last" } }),
};

function num(value: Prisma.Decimal | null): number | null {
	return value === null ? null : value.toNumber();
}

@Injectable()
export class QuotesService {
	private readonly logger = new Logger(QuotesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async list(
		agencyId: string,
		input: QuoteListInput,
	): Promise<ListResult<QuoteRow>> {
		const scoped = agencyDb(this.db, agencyId);
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			scoped.quote.findMany({
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
					validUntil: true,
					_count: { select: { options: true } },
					createdAt: true,
					archivedAt: true,
				},
			}),
			scoped.quote.count({ where }),
			this.facetCounts(agencyId, input),
		]);

		return {
			rows: rows.map((row) => ({
				id: row.id,
				folio: row.folio,
				status: row.status,
				customer: row.customer,
				owner: row.owner,
				destination: row.destination,
				currency: row.currency,
				travelStartDate: row.travelStartDate?.toISOString() ?? null,
				validUntil: row.validUntil?.toISOString() ?? null,
				optionCount: row._count.options,
				createdAt: row.createdAt.toISOString(),
				archivedAt: row.archivedAt?.toISOString() ?? null,
			})),
			total,
			facetCounts,
		};
	}

	async byId(agencyId: string, role: AgencyRole, id: string) {
		const scoped = agencyDb(this.db, agencyId);
		const seeMargins = canSeeMargins(role);
		const quote = await scoped.quote.findFirst({
			where: { id },
			select: {
				id: true,
				folio: true,
				status: true,
				customer: { select: { id: true, name: true } },
				owner: { select: OWNER_SELECT },
				ownerId: true,
				destination: true,
				currency: true,
				validUntil: true,
				travelStartDate: true,
				travelEndDate: true,
				paxAdults: true,
				paxChildren: true,
				paxInfants: true,
				notes: true,
				terms: true,
				sentAt: true,
				decidedAt: true,
				createdAt: true,
				updatedAt: true,
				archivedAt: true,
				options: {
					orderBy: { position: "asc" },
					select: {
						id: true,
						label: true,
						position: true,
						isRecommended: true,
						sellTotalBase: true,
						costTotalBase: true,
						baseCurrency: true,
						items: {
							orderBy: { position: "asc" },
							select: {
								id: true,
								type: true,
								status: true,
								supplierId: true,
								description: true,
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
					},
				},
			},
		});

		if (!quote) {
			throw new NotFoundException("That quote does not exist.");
		}

		return {
			id: quote.id,
			folio: quote.folio,
			status: quote.status,
			customer: quote.customer,
			owner: quote.owner,
			ownerId: quote.ownerId,
			destination: quote.destination,
			currency: quote.currency,
			travelStartDate: quote.travelStartDate?.toISOString() ?? null,
			travelEndDate: quote.travelEndDate?.toISOString() ?? null,
			validUntil: quote.validUntil?.toISOString() ?? null,
			paxAdults: quote.paxAdults,
			paxChildren: quote.paxChildren,
			paxInfants: quote.paxInfants,
			notes: quote.notes,
			terms: quote.terms,
			sentAt: quote.sentAt?.toISOString() ?? null,
			decidedAt: quote.decidedAt?.toISOString() ?? null,
			optionCount: quote.options.length,
			createdAt: quote.createdAt.toISOString(),
			updatedAt: quote.updatedAt.toISOString(),
			archivedAt: quote.archivedAt?.toISOString() ?? null,
			options: quote.options.map((option) => {
				const unpriced = option.items.filter(
					(item) =>
						item.sellBaseAmount === null || item.costBaseAmount === null,
				).length;
				const sellTotal = num(option.sellTotalBase);
				const costTotal = num(option.costTotalBase);
				return {
					id: option.id,
					label: option.label,
					position: option.position,
					isRecommended: option.isRecommended,
					sellTotalBase: seeMargins ? sellTotal : null,
					costTotalBase: seeMargins ? costTotal : null,
					marginBase:
						seeMargins && sellTotal !== null && costTotal !== null
							? sellTotal - costTotal
							: null,
					baseCurrency: option.baseCurrency,
					unpricedItems: unpriced,
					items: option.items.map((item) => ({
						id: item.id,
						type: item.type,
						status: item.status,
						supplierId: item.supplierId,
						description: item.description,
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
				};
			}),
		};
	}

	async create(agencyId: string, input: QuoteCreate) {
		await this.requireCustomer(agencyId, input.customerId);
		await requireAgencyMember(this.db, agencyId, input.ownerId);

		const settings = await this.settings(agencyId);

		const quote = await this.db.$transaction(async (tx) => {
			const value = await nextCounter(tx, agencyId, COUNTER_KIND.quote);
			const folio = formatFolio(
				settings.quotePrefix,
				new Date().getFullYear(),
				value,
			);

			return tx.quote.create({
				data: {
					agencyId,
					folio,
					customerId: input.customerId,
					ownerId: input.ownerId,
					destination: input.destination
						? blankToNull(input.destination)
						: null,
					currency: input.currency.trim().toUpperCase(),
					validUntil: input.validUntil ? new Date(input.validUntil) : null,
					travelStartDate: input.travelStartDate
						? new Date(input.travelStartDate)
						: null,
					travelEndDate: input.travelEndDate
						? new Date(input.travelEndDate)
						: null,
					paxAdults: input.paxAdults,
					paxChildren: input.paxChildren,
					paxInfants: input.paxInfants,
					notes: input.notes ? blankToNull(input.notes) : null,
					terms: input.terms ? blankToNull(input.terms) : null,
				},
				select: { id: true, folio: true },
			});
		});

		this.logger.log({
			message: "Quote created",
			agencyId,
			quoteId: quote.id,
			folio: quote.folio,
		});

		return quote;
	}

	async update(
		agencyId: string,
		id: string,
		data: Partial<QuoteCreate> & { status?: string },
	) {
		const scoped = agencyDb(this.db, agencyId);
		const current = await scoped.quote.findFirst({
			where: { id },
			select: { id: true, status: true, sentAt: true, decidedAt: true },
		});

		if (!current) {
			throw new NotFoundException("That quote does not exist.");
		}

		if (data.customerId !== undefined) {
			await this.requireCustomer(agencyId, data.customerId);
		}
		if (data.ownerId !== undefined) {
			await requireAgencyMember(this.db, agencyId, data.ownerId);
		}

		const patch: Prisma.QuoteUpdateInput = {};
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
		if (data.validUntil !== undefined) {
			patch.validUntil = data.validUntil ? new Date(data.validUntil) : null;
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
		if (data.paxAdults !== undefined) patch.paxAdults = data.paxAdults;
		if (data.paxChildren !== undefined) patch.paxChildren = data.paxChildren;
		if (data.paxInfants !== undefined) patch.paxInfants = data.paxInfants;
		if (data.notes !== undefined) {
			patch.notes = data.notes ? blankToNull(data.notes) : null;
		}
		if (data.terms !== undefined) {
			patch.terms = data.terms ? blankToNull(data.terms) : null;
		}
		if (data.status !== undefined && data.status !== current.status) {
			patch.status = data.status as Prisma.QuoteUpdateInput["status"];
			if (data.status === "SENT" && !current.sentAt) {
				patch.sentAt = new Date();
			}
			if (
				(data.status === "ACCEPTED" ||
					data.status === "DECLINED" ||
					data.status === "EXPIRED") &&
				!current.decidedAt
			) {
				patch.decidedAt = new Date();
			}
		}

		try {
			return await scoped.quote.update({
				where: { id },
				data: patch,
				select: { id: true, folio: true },
			});
		} catch (cause) {
			this.translate(cause);
		}
	}

	async setOptions(
		agencyId: string,
		role: AgencyRole,
		id: string,
		options: {
			label: string;
			position: number;
			isRecommended: boolean;
			items: ItineraryItemInput[];
		}[],
	) {
		const scoped = agencyDb(this.db, agencyId);
		const quote = await scoped.quote.findFirst({
			where: { id },
			select: { id: true, status: true },
		});

		if (!quote) {
			throw new NotFoundException("That quote does not exist.");
		}
		if (quote.status === "ACCEPTED") {
			throw new ConflictException(
				"An accepted quote cannot change its options.",
			);
		}

		const built = await Promise.all(
			options.map(async (option) => ({
				option,
				items: await Promise.all(
					option.items.map((item) =>
						buildItineraryItemData(agencyId, this.conversion, item),
					),
				),
			})),
		);

		await scoped.$transaction(async (tx) => {
			await tx.quoteOption.deleteMany({ where: { quoteId: id } });

			for (const [index, group] of built.entries()) {
				const totals = itemBaseTotals(group.items);
				const baseCurrency =
					group.items[0]?.baseCurrency ??
					(await this.conversion.baseCurrencyFor(agencyId));

				const created = await tx.quoteOption.create({
					data: {
						agencyId,
						quoteId: id,
						label: group.option.label,
						position: group.option.position || index,
						isRecommended: group.option.isRecommended,
						sellTotalBase: totals.missing === 0 ? totals.sell : null,
						costTotalBase: totals.missing === 0 ? totals.cost : null,
						baseCurrency,
					},
					select: { id: true },
				});

				for (const [itemIndex, itemData] of group.items.entries()) {
					await tx.quoteItem.create({
						data: {
							agencyId,
							quoteOptionId: created.id,
							...itemData,
							position: itemData.position || itemIndex,
						},
					});
				}
			}
		});

		this.logger.log({
			message: "Quote options replaced",
			agencyId,
			quoteId: id,
			options: built.length,
		});

		return this.byId(agencyId, role, id);
	}

	async accept(agencyId: string, id: string, optionId: string) {
		const scoped = agencyDb(this.db, agencyId);
		const quote = await scoped.quote.findFirst({
			where: { id },
			select: {
				id: true,
				status: true,
				customerId: true,
				ownerId: true,
				currency: true,
				destination: true,
				travelStartDate: true,
				travelEndDate: true,
				booking: { select: { id: true } },
				options: {
					where: { id: optionId },
					select: {
						id: true,
						baseCurrency: true,
						sellTotalBase: true,
						costTotalBase: true,
						items: true,
					},
				},
			},
		});

		if (!quote) {
			throw new NotFoundException("That quote does not exist.");
		}
		if (quote.booking) {
			throw new ConflictException("That quote already has a booking.");
		}
		const option = quote.options[0];
		if (!option) {
			throw new NotFoundException("That option is not on this quote.");
		}

		const settings = await this.settings(agencyId);

		const result = await this.db.$transaction(async (tx) => {
			const value = await nextCounter(tx, agencyId, COUNTER_KIND.booking);
			const folio = formatFolio(
				settings.bookingPrefix,
				new Date().getFullYear(),
				value,
			);

			const booking = await tx.booking.create({
				data: {
					agencyId,
					folio,
					customerId: quote.customerId,
					ownerId: quote.ownerId,
					quoteId: quote.id,
					status: "DRAFT",
					destination: quote.destination,
					currency: quote.currency,
					travelStartDate: quote.travelStartDate,
					travelEndDate: quote.travelEndDate,
					sellTotalBase: option.sellTotalBase,
					costTotalBase: option.costTotalBase,
					baseCurrency: option.baseCurrency,
				},
				select: { id: true, folio: true },
			});

			for (const item of option.items) {
				await tx.bookingItem.create({
					data: {
						agencyId,
						bookingId: booking.id,
						type: item.type,
						supplierId: item.supplierId,
						confirmationCode: item.confirmationCode,
						status: item.status,
						startsAt: item.startsAt,
						endsAt: item.endsAt,
						startLocation: item.startLocation,
						endLocation: item.endLocation,
						description: item.description,
						paxCount: item.paxCount,
						position: item.position,
						costAmount: item.costAmount,
						costCurrency: item.costCurrency,
						sellAmount: item.sellAmount,
						sellCurrency: item.sellCurrency,
						costBaseAmount: item.costBaseAmount,
						sellBaseAmount: item.sellBaseAmount,
						baseCurrency: item.baseCurrency,
						fxRate: item.fxRate,
						fxRateAt: item.fxRateAt,
						details: item.details as Prisma.InputJsonValue,
					},
				});
			}

			await tx.quoteOption.updateMany({
				where: { quoteId: quote.id, agencyId },
				data: { isRecommended: false },
			});
			await tx.quoteOption.update({
				where: { id: option.id },
				data: { isRecommended: true },
			});
			await tx.quote.update({
				where: { id: quote.id },
				data: { status: "ACCEPTED", decidedAt: new Date() },
			});

			return booking;
		});

		this.logger.log({
			message: "Quote accepted",
			agencyId,
			quoteId: id,
			bookingId: result.id,
		});

		return {
			quoteId: id,
			bookingId: result.id,
			bookingFolio: result.folio,
		};
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
			await scoped.quote.delete({ where: { id } });
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
			const row = await scoped.quote.update({
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
			select: { quotePrefix: true, bookingPrefix: true },
		});
		return {
			quotePrefix: row?.quotePrefix ?? "COT",
			bookingPrefix: row?.bookingPrefix ?? "EXP",
		};
	}

	private buildWhere(input: QuoteListInput): Prisma.QuoteWhereInput {
		const clauses: Prisma.QuoteWhereInput[] = [archivedFilter(input.archived)];

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
			clauses.push(owner as Prisma.QuoteWhereInput);
		}

		return { AND: clauses };
	}

	private async facetCounts(agencyId: string, input: QuoteListInput) {
		const scoped = agencyDb(this.db, agencyId);
		const base = this.buildWhere({ ...input, status: [], owner: [] });

		const [byStatus, byOwner] = await Promise.all([
			scoped.quote.groupBy({
				by: ["status"],
				where: base,
				_count: { _all: true },
			}),
			scoped.quote.groupBy({
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
			throw new NotFoundException("That quote does not exist.");
		}
		if (code === "P2002") {
			throw new ConflictException("That folio is already taken.");
		}
		throw cause;
	}
}
