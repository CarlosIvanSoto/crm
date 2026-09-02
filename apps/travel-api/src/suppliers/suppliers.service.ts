import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { agencyDb, type Db, Prisma } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { runBulk } from "../travel/bulk";
import { blankToNull } from "../travel/values";
import {
	archivedFilter,
	countsByKey,
	type ListResult,
	type OrderByColumns,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	SupplierCreateInput,
	SupplierListInput,
	SupplierRow,
} from "./suppliers.contracts";

const SORTABLE: OrderByColumns<Prisma.SupplierOrderByWithRelationInput> = {
	name: (dir) => ({ name: dir }),
	kind: (dir) => ({ kind: dir }),
	createdAt: (dir) => ({ createdAt: dir }),
	archivedAt: (dir) => ({ archivedAt: { sort: dir, nulls: "last" } }),
};

function num(value: Prisma.Decimal | null): number | null {
	return value === null ? null : value.toNumber();
}

@Injectable()
export class SuppliersService {
	private readonly logger = new Logger(SuppliersService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(
		agencyId: string,
		input: SupplierListInput,
	): Promise<ListResult<SupplierRow>> {
		const scoped = agencyDb(this.db, agencyId);
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			scoped.supplier.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, { name: "asc" }),
				select: {
					id: true,
					kind: true,
					name: true,
					email: true,
					phone: true,
					defaultCurrency: true,
					_count: { select: { quoteItems: true, bookingItems: true } },
					createdAt: true,
					archivedAt: true,
				},
			}),
			scoped.supplier.count({ where }),
			this.facetCounts(agencyId, input),
		]);

		return {
			rows: rows.map((row) => ({
				id: row.id,
				kind: row.kind,
				name: row.name,
				email: row.email,
				phone: row.phone,
				defaultCurrency: row.defaultCurrency,
				quoteItemCount: row._count.quoteItems,
				bookingItemCount: row._count.bookingItems,
				createdAt: row.createdAt.toISOString(),
				archivedAt: row.archivedAt?.toISOString() ?? null,
			})),
			total,
			facetCounts,
		};
	}

	async byId(agencyId: string, id: string) {
		const scoped = agencyDb(this.db, agencyId);
		const supplier = await scoped.supplier.findFirst({
			where: { id },
			select: {
				id: true,
				kind: true,
				name: true,
				email: true,
				phone: true,
				defaultCurrency: true,
				defaultCommissionRate: true,
				paymentTermsDays: true,
				notes: true,
				_count: { select: { quoteItems: true, bookingItems: true } },
				createdAt: true,
				updatedAt: true,
				archivedAt: true,
			},
		});

		if (!supplier) {
			throw new NotFoundException("That supplier does not exist.");
		}

		const { _count, ...rest } = supplier;

		return {
			...rest,
			defaultCommissionRate: num(supplier.defaultCommissionRate),
			quoteItemCount: _count.quoteItems,
			bookingItemCount: _count.bookingItems,
			createdAt: supplier.createdAt.toISOString(),
			updatedAt: supplier.updatedAt.toISOString(),
			archivedAt: supplier.archivedAt?.toISOString() ?? null,
		};
	}

	async options(agencyId: string, q: string) {
		const scoped = agencyDb(this.db, agencyId);
		const term = q.trim();

		const where: Prisma.SupplierWhereInput = { archivedAt: null };
		if (term) {
			where.name = { contains: term, mode: "insensitive" };
		}

		return scoped.supplier.findMany({
			where,
			select: { id: true, name: true, kind: true },
			orderBy: { name: "asc" },
			take: 20,
		});
	}

	async create(agencyId: string, input: SupplierCreateInput) {
		const scoped = agencyDb(this.db, agencyId);

		const supplier = await scoped.supplier.create({
			data: {
				agencyId,
				kind: input.kind,
				name: input.name.trim(),
				email: input.email ? input.email.trim().toLowerCase() : null,
				phone: input.phone ? blankToNull(input.phone) : null,
				defaultCommissionRate:
					input.defaultCommissionRate === null
						? null
						: new Prisma.Decimal(input.defaultCommissionRate),
				paymentTermsDays: input.paymentTermsDays,
				defaultCurrency: input.defaultCurrency,
				notes: input.notes ? blankToNull(input.notes) : null,
			},
			select: { id: true, name: true },
		});

		this.logger.log({
			message: "Supplier created",
			agencyId,
			supplierId: supplier.id,
		});

		return supplier;
	}

	async update(
		agencyId: string,
		id: string,
		data: Partial<SupplierCreateInput>,
	) {
		const scoped = agencyDb(this.db, agencyId);
		await this.ensureExists(scoped, id);

		try {
			return await scoped.supplier.update({
				where: { id },
				data: {
					...(data.kind !== undefined && { kind: data.kind }),
					...(data.name !== undefined && { name: data.name.trim() }),
					...(data.email !== undefined && {
						email: data.email ? data.email.trim().toLowerCase() : null,
					}),
					...(data.phone !== undefined && {
						phone: data.phone ? blankToNull(data.phone) : null,
					}),
					...(data.defaultCommissionRate !== undefined && {
						defaultCommissionRate:
							data.defaultCommissionRate === null
								? null
								: new Prisma.Decimal(data.defaultCommissionRate),
					}),
					...(data.paymentTermsDays !== undefined && {
						paymentTermsDays: data.paymentTermsDays,
					}),
					...(data.defaultCurrency !== undefined && {
						defaultCurrency: data.defaultCurrency,
					}),
					...(data.notes !== undefined && {
						notes: data.notes ? blankToNull(data.notes) : null,
					}),
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
			await scoped.supplier.delete({ where: { id } });
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
			const row = await scoped.supplier.update({
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
		const found = await scoped.supplier.findFirst({
			where: { id },
			select: { id: true },
		});
		if (!found) {
			throw new NotFoundException("That supplier does not exist.");
		}
	}

	private buildWhere(input: SupplierListInput): Prisma.SupplierWhereInput {
		const clauses: Prisma.SupplierWhereInput[] = [
			archivedFilter(input.archived),
		];

		const term = input.q.trim();
		if (term) {
			clauses.push({
				OR: [
					{ name: { contains: term, mode: "insensitive" } },
					{ email: { contains: term, mode: "insensitive" } },
				],
			});
		}

		if (input.kind.length > 0) {
			clauses.push({ kind: { in: input.kind } });
		}

		return { AND: clauses };
	}

	private async facetCounts(agencyId: string, input: SupplierListInput) {
		const scoped = agencyDb(this.db, agencyId);
		const base = this.buildWhere({ ...input, kind: [] });

		const byKind = await scoped.supplier.groupBy({
			by: ["kind"],
			where: base,
			_count: { _all: true },
		});

		return {
			kind: countsByKey(byKind, "kind"),
		};
	}

	private translate(cause: unknown): never {
		const code = (cause as { code?: string }).code;
		if (code === "P2025") {
			throw new NotFoundException("That supplier does not exist.");
		}
		if (code === "P2002") {
			throw new ConflictException("That supplier already exists.");
		}
		throw cause;
	}
}
