import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { agencyDb, type Db, type Prisma } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { requireAgencyMember, runBulk } from "../travel/bulk";
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
	CustomerCreateInput,
	CustomerListInput,
	CustomerRow,
} from "./customers.contracts";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const SORTABLE: OrderByColumns<Prisma.CustomerOrderByWithRelationInput> = {
	name: (dir) => ({ name: dir }),
	email: (dir) => ({ email: { sort: dir, nulls: "last" } }),
	createdAt: (dir) => ({ createdAt: dir }),
	owner: (dir) => ({ owner: { name: dir } }),
	lastActivity: (dir) => ({ lastActivityAt: { sort: dir, nulls: "last" } }),
	archivedAt: (dir) => ({ archivedAt: { sort: dir, nulls: "last" } }),
};

@Injectable()
export class CustomersService {
	private readonly logger = new Logger(CustomersService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(
		agencyId: string,
		input: CustomerListInput,
	): Promise<ListResult<CustomerRow>> {
		const scoped = agencyDb(this.db, agencyId);
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			scoped.customer.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "desc" }),
				select: {
					id: true,
					type: true,
					name: true,
					email: true,
					phone: true,
					owner: { select: OWNER_SELECT },
					_count: { select: { quotes: true, bookings: true } },
					lastActivityAt: true,
					createdAt: true,
					archivedAt: true,
				},
			}),
			scoped.customer.count({ where }),
			this.facetCounts(agencyId, input),
		]);

		return {
			rows: rows.map((row) => ({
				id: row.id,
				type: row.type,
				name: row.name,
				email: row.email,
				phone: row.phone,
				owner: row.owner,
				quoteCount: row._count.quotes,
				bookingCount: row._count.bookings,
				lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
				archivedAt: row.archivedAt?.toISOString() ?? null,
			})),
			total,
			facetCounts,
		};
	}

	async byId(agencyId: string, id: string) {
		const scoped = agencyDb(this.db, agencyId);
		const customer = await scoped.customer.findFirst({
			where: { id },
			select: {
				id: true,
				type: true,
				name: true,
				legalName: true,
				taxId: true,
				taxRegime: true,
				email: true,
				phone: true,
				whatsapp: true,
				owner: { select: OWNER_SELECT },
				_count: { select: { quotes: true, bookings: true } },
				lastActivityAt: true,
				createdAt: true,
				updatedAt: true,
				archivedAt: true,
			},
		});

		if (!customer) {
			throw new NotFoundException("That customer does not exist.");
		}

		const { _count, ...rest } = customer;

		return {
			...rest,
			quoteCount: _count.quotes,
			bookingCount: _count.bookings,
			lastActivityAt: customer.lastActivityAt?.toISOString() ?? null,
			createdAt: customer.createdAt.toISOString(),
			updatedAt: customer.updatedAt.toISOString(),
			archivedAt: customer.archivedAt?.toISOString() ?? null,
		};
	}

	async options(agencyId: string, q: string) {
		const scoped = agencyDb(this.db, agencyId);
		const term = q.trim();

		const where: Prisma.CustomerWhereInput = { archivedAt: null };
		if (term) {
			where.name = { contains: term, mode: "insensitive" };
		}

		return scoped.customer.findMany({
			where,
			select: { id: true, name: true, email: true },
			orderBy: { name: "asc" },
			take: 20,
		});
	}

	async create(agencyId: string, input: CustomerCreateInput) {
		const scoped = agencyDb(this.db, agencyId);
		await requireAgencyMember(this.db, agencyId, input.ownerId);

		const customer = await scoped.customer.create({
			data: {
				agencyId,
				type: input.type,
				name: input.name.trim(),
				legalName: input.legalName ? blankToNull(input.legalName) : null,
				taxId: input.taxId ? blankToNull(input.taxId) : null,
				taxRegime: input.taxRegime ? blankToNull(input.taxRegime) : null,
				email: input.email ? input.email.trim().toLowerCase() : null,
				phone: input.phone ? blankToNull(input.phone) : null,
				whatsapp: input.whatsapp ? blankToNull(input.whatsapp) : null,
				ownerId: input.ownerId,
			},
			select: { id: true, name: true },
		});

		this.logger.log({
			message: "Customer created",
			agencyId,
			customerId: customer.id,
		});

		return customer;
	}

	async update(
		agencyId: string,
		id: string,
		data: Partial<CustomerCreateInput>,
	) {
		const scoped = agencyDb(this.db, agencyId);
		await this.ensureExists(scoped, id);

		if (data.ownerId !== undefined) {
			await requireAgencyMember(this.db, agencyId, data.ownerId);
		}

		try {
			return await scoped.customer.update({
				where: { id },
				data: {
					...(data.type !== undefined && { type: data.type }),
					...(data.name !== undefined && { name: data.name.trim() }),
					...(data.legalName !== undefined && {
						legalName: data.legalName ? blankToNull(data.legalName) : null,
					}),
					...(data.taxId !== undefined && {
						taxId: data.taxId ? blankToNull(data.taxId) : null,
					}),
					...(data.taxRegime !== undefined && {
						taxRegime: data.taxRegime ? blankToNull(data.taxRegime) : null,
					}),
					...(data.email !== undefined && {
						email: data.email ? data.email.trim().toLowerCase() : null,
					}),
					...(data.phone !== undefined && {
						phone: data.phone ? blankToNull(data.phone) : null,
					}),
					...(data.whatsapp !== undefined && {
						whatsapp: data.whatsapp ? blankToNull(data.whatsapp) : null,
					}),
					...(data.ownerId !== undefined && { ownerId: data.ownerId }),
				},
				select: { id: true, name: true },
			});
		} catch (cause) {
			this.translate(cause);
		}
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
			await scoped.customer.delete({ where: { id } });
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

	async bulkAssignOwner(
		agencyId: string,
		ids: string[],
		ownerId: string | null,
	) {
		await requireAgencyMember(this.db, agencyId, ownerId);
		const scoped = agencyDb(this.db, agencyId);
		return runBulk(ids, async (id) => {
			await this.ensureExists(scoped, id);
			return scoped.customer.update({
				where: { id },
				data: { ownerId },
				select: { id: true },
			});
		});
	}

	private async setArchived(
		agencyId: string,
		id: string,
		archivedAt: Date | null,
	) {
		const scoped = agencyDb(this.db, agencyId);
		try {
			const row = await scoped.customer.update({
				where: { id },
				data: { archivedAt },
				select: { id: true, archivedAt: true },
			});
			return {
				id: row.id,
				archivedAt: row.archivedAt?.toISOString() ?? null,
			};
		} catch (cause) {
			this.translate(cause);
		}
	}

	private async ensureExists(
		scoped: ReturnType<typeof agencyDb>,
		id: string,
	): Promise<void> {
		const found = await scoped.customer.findFirst({
			where: { id },
			select: { id: true },
		});
		if (!found) {
			throw new NotFoundException("That customer does not exist.");
		}
	}

	private buildWhere(input: CustomerListInput): Prisma.CustomerWhereInput {
		const clauses: Prisma.CustomerWhereInput[] = [
			archivedFilter(input.archived),
		];

		const term = input.q.trim();
		if (term) {
			clauses.push({
				OR: [
					{ name: { contains: term, mode: "insensitive" } },
					{ email: { contains: term, mode: "insensitive" } },
					{ taxId: { contains: term, mode: "insensitive" } },
				],
			});
		}

		if (input.type.length > 0) {
			clauses.push({ type: { in: input.type } });
		}

		const owner = ownerFilter(input.owner);
		if (owner) {
			clauses.push(owner as Prisma.CustomerWhereInput);
		}

		return { AND: clauses };
	}

	private async facetCounts(agencyId: string, input: CustomerListInput) {
		const scoped = agencyDb(this.db, agencyId);
		const base = this.buildWhere({ ...input, type: [], owner: [] });

		const [byType, byOwner] = await Promise.all([
			scoped.customer.groupBy({
				by: ["type"],
				where: base,
				_count: { _all: true },
			}),
			scoped.customer.groupBy({
				by: ["ownerId"],
				where: base,
				_count: { _all: true },
			}),
		]);

		return {
			type: countsByKey(byType, "type"),
			owner: countsByKey(byOwner, "ownerId", "unassigned"),
		};
	}

	private translate(cause: unknown): never {
		const code = (cause as { code?: string }).code;
		if (code === "P2025") {
			throw new NotFoundException("That customer does not exist.");
		}
		if (code === "P2002") {
			throw new ConflictException("That customer already exists.");
		}
		throw cause;
	}
}
