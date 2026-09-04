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
	SetLoyaltyInput,
	TravelerCreateInput,
	TravelerListInput,
	TravelerRow,
} from "./travelers.contracts";

const SORTABLE: OrderByColumns<Prisma.TravelerOrderByWithRelationInput> = {
	name: (dir) => ({ lastName: dir }),
	createdAt: (dir) => ({ createdAt: dir }),
	documentExpiresAt: (dir) => ({
		documentExpiresAt: { sort: dir, nulls: "last" },
	}),
	archivedAt: (dir) => ({ archivedAt: { sort: dir, nulls: "last" } }),
};

@Injectable()
export class TravelersService {
	private readonly logger = new Logger(TravelersService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(
		agencyId: string,
		input: TravelerListInput,
	): Promise<ListResult<TravelerRow>> {
		const scoped = agencyDb(this.db, agencyId);
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			scoped.traveler.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, {
					lastName: "asc",
				}),
				select: {
					id: true,
					firstName: true,
					lastName: true,
					nationality: true,
					documentType: true,
					documentNumber: true,
					documentExpiresAt: true,
					customerId: true,
					customer: { select: { name: true } },
					_count: { select: { bookingTravelers: true } },
					createdAt: true,
					archivedAt: true,
				},
			}),
			scoped.traveler.count({ where }),
			this.facetCounts(agencyId, input),
		]);

		return {
			rows: rows.map((row) => ({
				id: row.id,
				firstName: row.firstName,
				lastName: row.lastName,
				nationality: row.nationality,
				documentType: row.documentType,
				documentNumber: row.documentNumber,
				documentExpiresAt: row.documentExpiresAt?.toISOString() ?? null,
				customerId: row.customerId,
				customerName: row.customer?.name ?? null,
				bookingCount: row._count.bookingTravelers,
				createdAt: row.createdAt.toISOString(),
				archivedAt: row.archivedAt?.toISOString() ?? null,
			})),
			total,
			facetCounts,
		};
	}

	async byId(agencyId: string, id: string) {
		const scoped = agencyDb(this.db, agencyId);
		const traveler = await scoped.traveler.findFirst({
			where: { id },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				dateOfBirth: true,
				gender: true,
				nationality: true,
				documentType: true,
				documentNumber: true,
				documentIssuedCountry: true,
				documentExpiresAt: true,
				dietaryNotes: true,
				medicalNotes: true,
				customerId: true,
				customer: { select: { name: true } },
				_count: { select: { bookingTravelers: true, documents: true } },
				loyalty: {
					select: {
						id: true,
						supplierId: true,
						programName: true,
						number: true,
					},
					orderBy: { programName: "asc" },
				},
				createdAt: true,
				updatedAt: true,
				archivedAt: true,
			},
		});

		if (!traveler) {
			throw new NotFoundException("That traveler does not exist.");
		}

		const { _count, customer, ...rest } = traveler;

		return {
			...rest,
			customerName: customer?.name ?? null,
			dateOfBirth: traveler.dateOfBirth?.toISOString() ?? null,
			documentExpiresAt: traveler.documentExpiresAt?.toISOString() ?? null,
			bookingCount: _count.bookingTravelers,
			documentCount: _count.documents,
			createdAt: traveler.createdAt.toISOString(),
			updatedAt: traveler.updatedAt.toISOString(),
			archivedAt: traveler.archivedAt?.toISOString() ?? null,
		};
	}

	async options(agencyId: string, q: string) {
		const scoped = agencyDb(this.db, agencyId);
		const term = q.trim();

		const where: Prisma.TravelerWhereInput = { archivedAt: null };
		if (term) {
			where.OR = [
				{ firstName: { contains: term, mode: "insensitive" } },
				{ lastName: { contains: term, mode: "insensitive" } },
			];
		}

		return scoped.traveler.findMany({
			where,
			select: { id: true, firstName: true, lastName: true },
			orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
			take: 20,
		});
	}

	async create(agencyId: string, input: TravelerCreateInput) {
		const scoped = agencyDb(this.db, agencyId);
		if (input.customerId) {
			await this.requireCustomer(scoped, input.customerId);
		}

		const traveler = await scoped.traveler.create({
			data: {
				agencyId,
				firstName: input.firstName.trim(),
				lastName: input.lastName.trim(),
				dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
				gender: input.gender ? blankToNull(input.gender) : null,
				nationality: input.nationality ? blankToNull(input.nationality) : null,
				documentType: input.documentType,
				documentNumber: input.documentNumber
					? blankToNull(input.documentNumber)
					: null,
				documentIssuedCountry: input.documentIssuedCountry
					? blankToNull(input.documentIssuedCountry)
					: null,
				documentExpiresAt: input.documentExpiresAt
					? new Date(input.documentExpiresAt)
					: null,
				dietaryNotes: input.dietaryNotes
					? blankToNull(input.dietaryNotes)
					: null,
				medicalNotes: input.medicalNotes
					? blankToNull(input.medicalNotes)
					: null,
				customerId: input.customerId,
			},
			select: { id: true, firstName: true, lastName: true },
		});

		this.logger.log({
			message: "Traveler created",
			agencyId,
			travelerId: traveler.id,
		});

		return traveler;
	}

	async update(
		agencyId: string,
		id: string,
		data: Partial<TravelerCreateInput>,
	) {
		const scoped = agencyDb(this.db, agencyId);
		await this.ensureExists(scoped, id);

		if (data.customerId !== undefined && data.customerId !== null) {
			await this.requireCustomer(scoped, data.customerId);
		}

		try {
			return await scoped.traveler.update({
				where: { id },
				data: {
					...(data.firstName !== undefined && {
						firstName: data.firstName.trim(),
					}),
					...(data.lastName !== undefined && {
						lastName: data.lastName.trim(),
					}),
					...(data.dateOfBirth !== undefined && {
						dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
					}),
					...(data.gender !== undefined && {
						gender: data.gender ? blankToNull(data.gender) : null,
					}),
					...(data.nationality !== undefined && {
						nationality: data.nationality
							? blankToNull(data.nationality)
							: null,
					}),
					...(data.documentType !== undefined && {
						documentType: data.documentType,
					}),
					...(data.documentNumber !== undefined && {
						documentNumber: data.documentNumber
							? blankToNull(data.documentNumber)
							: null,
					}),
					...(data.documentIssuedCountry !== undefined && {
						documentIssuedCountry: data.documentIssuedCountry
							? blankToNull(data.documentIssuedCountry)
							: null,
					}),
					...(data.documentExpiresAt !== undefined && {
						documentExpiresAt: data.documentExpiresAt
							? new Date(data.documentExpiresAt)
							: null,
					}),
					...(data.dietaryNotes !== undefined && {
						dietaryNotes: data.dietaryNotes
							? blankToNull(data.dietaryNotes)
							: null,
					}),
					...(data.medicalNotes !== undefined && {
						medicalNotes: data.medicalNotes
							? blankToNull(data.medicalNotes)
							: null,
					}),
					...(data.customerId !== undefined && {
						customerId: data.customerId,
					}),
				},
				select: { id: true, firstName: true, lastName: true },
			});
		} catch (cause) {
			this.translate(cause);
		}
	}

	async setLoyalty(agencyId: string, input: SetLoyaltyInput) {
		const scoped = agencyDb(this.db, agencyId);
		await this.ensureExists(scoped, input.id);

		for (const entry of input.entries) {
			if (entry.supplierId) {
				const supplier = await scoped.supplier.findFirst({
					where: { id: entry.supplierId },
					select: { id: true },
				});
				if (!supplier) {
					throw new NotFoundException("That supplier does not exist.");
				}
			}
		}

		await scoped.$transaction(async (tx) => {
			await tx.travelerLoyalty.deleteMany({ where: { travelerId: input.id } });

			for (const entry of input.entries) {
				await tx.travelerLoyalty.create({
					data: {
						agencyId,
						travelerId: input.id,
						supplierId: entry.supplierId,
						programName: entry.programName.trim(),
						number: entry.number.trim(),
					},
				});
			}
		});

		this.logger.log({
			message: "Traveler loyalty replaced",
			agencyId,
			travelerId: input.id,
			entries: input.entries.length,
		});

		return this.byId(agencyId, input.id);
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
			await scoped.traveler.delete({ where: { id } });
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
			const row = await scoped.traveler.update({
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
		const found = await scoped.traveler.findFirst({
			where: { id },
			select: { id: true },
		});
		if (!found) {
			throw new NotFoundException("That traveler does not exist.");
		}
	}

	private async requireCustomer(
		scoped: ReturnType<typeof agencyDb>,
		customerId: string,
	): Promise<void> {
		const customer = await scoped.customer.findFirst({
			where: { id: customerId },
			select: { id: true },
		});
		if (!customer) {
			throw new NotFoundException("That customer does not exist.");
		}
	}

	private buildWhere(input: TravelerListInput): Prisma.TravelerWhereInput {
		const clauses: Prisma.TravelerWhereInput[] = [
			archivedFilter(input.archived),
		];

		const term = input.q.trim();
		if (term) {
			clauses.push({
				OR: [
					{ firstName: { contains: term, mode: "insensitive" } },
					{ lastName: { contains: term, mode: "insensitive" } },
					{ documentNumber: { contains: term, mode: "insensitive" } },
				],
			});
		}

		if (input.customer.length > 0) {
			clauses.push({ customerId: { in: input.customer } });
		}

		if (input.documentType.length > 0) {
			clauses.push({ documentType: { in: input.documentType } });
		}

		return { AND: clauses };
	}

	private async facetCounts(agencyId: string, input: TravelerListInput) {
		const scoped = agencyDb(this.db, agencyId);
		const base = this.buildWhere({ ...input, customer: [], documentType: [] });

		const [byCustomer, byDocumentType] = await Promise.all([
			scoped.traveler.groupBy({
				by: ["customerId"],
				where: base,
				_count: { _all: true },
			}),
			scoped.traveler.groupBy({
				by: ["documentType"],
				where: base,
				_count: { _all: true },
			}),
		]);

		return {
			customer: countsByKey(byCustomer, "customerId", "unassigned"),
			documentType: countsByKey(byDocumentType, "documentType", "none"),
		};
	}

	private translate(cause: unknown): never {
		const code = (cause as { code?: string }).code;
		if (code === "P2025") {
			throw new NotFoundException("That traveler does not exist.");
		}
		if (code === "P2002") {
			throw new ConflictException("That traveler already exists.");
		}
		throw cause;
	}
}
