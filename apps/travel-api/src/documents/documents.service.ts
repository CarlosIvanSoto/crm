import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { type AgencyRole, canSeeMargins } from "@travel/auth";
import { agencyDb, type Db, type Prisma } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { type BulkResult, runBulk } from "../travel/bulk";
import {
	countsByKey,
	type OrderByColumns,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import {
	createUploadToken,
	removeObject,
	signedDownloadUrl,
	storageEnabled,
} from "./document-storage";
import type {
	CreateDocumentInput,
	DocumentEntry,
	DocumentListInput,
	DocumentListResult,
	UpdateDocumentInput,
	UploadTokenInput,
} from "./documents.contracts";
import { DOCUMENTS } from "./documents-config";

const UPLOADER_SELECT = { id: true, name: true } as const;

const ENTRY_SELECT = {
	id: true,
	kind: true,
	filename: true,
	contentType: true,
	sizeBytes: true,
	bookingId: true,
	travelerId: true,
	uploadedBy: { select: UPLOADER_SELECT },
	createdAt: true,
} as const;

const LIST_SORTABLE: OrderByColumns<Prisma.DocumentOrderByWithRelationInput[]> =
	{
		createdAt: (dir) => [{ createdAt: dir }],
		filename: (dir) => [{ filename: dir }],
	};

const LIST_ORDER_FALLBACK: Prisma.DocumentOrderByWithRelationInput[] = [
	{ createdAt: "desc" },
];

type Entry = Prisma.DocumentGetPayload<{ select: typeof ENTRY_SELECT }>;

type Anchor = { bookingId?: string; travelerId?: string };

@Injectable()
export class DocumentsService {
	private readonly logger = new Logger(DocumentsService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	storage() {
		return {
			enabled: storageEnabled(),
			maxBytes: DOCUMENTS.upload.maxBytes,
			allowedContentTypes: [...DOCUMENTS.upload.allowedContentTypes],
		};
	}

	async uploadToken(agencyId: string, input: UploadTokenInput) {
		if (!storageEnabled()) {
			throw new ServiceUnavailableException(
				"Document storage is not configured.",
			);
		}

		if (
			!(DOCUMENTS.upload.allowedContentTypes as readonly string[]).includes(
				input.contentType,
			)
		) {
			throw new BadRequestException(
				`"${input.contentType}" cannot be uploaded here.`,
			);
		}

		if (input.sizeBytes > DOCUMENTS.upload.maxBytes) {
			throw new BadRequestException("That file is too large.");
		}

		const scoped = agencyDb(this.db, agencyId);
		await this.requireAnchor(scoped, input);

		const anchorId = input.bookingId ?? input.travelerId;
		const pathname = `agencies/${agencyId}/${anchorId}/${randomUUID()}-${sanitizeFilename(input.filename)}`;

		const token = await createUploadToken({
			pathname,
			contentType: input.contentType,
		});

		return { token, pathname };
	}

	async create(
		agencyId: string,
		viewerId: string,
		input: CreateDocumentInput,
	): Promise<DocumentEntry> {
		if (!input.pathname.startsWith(`agencies/${agencyId}/`)) {
			throw new BadRequestException("That upload does not belong here.");
		}

		const scoped = agencyDb(this.db, agencyId);
		await this.requireAnchor(scoped, input);

		const document = await scoped.document.create({
			data: {
				agencyId,
				bookingId: input.bookingId ?? null,
				travelerId: input.travelerId ?? null,
				kind: input.kind,
				pathname: input.pathname,
				url: input.url,
				filename: input.filename,
				contentType: input.contentType,
				sizeBytes: input.sizeBytes,
				uploadedById: viewerId,
			},
			select: ENTRY_SELECT,
		});

		this.logger.log({
			message: "Document uploaded",
			agencyId,
			documentId: document.id,
			kind: document.kind,
		});

		return serializeEntry(document);
	}

	async list(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		input: DocumentListInput,
	): Promise<DocumentListResult> {
		const scoped = agencyDb(this.db, agencyId);

		const base: Prisma.DocumentWhereInput = {
			...this.scopeFilter(role, viewerId),
		};
		if (input.bookingId) base.bookingId = input.bookingId;
		if (input.travelerId) base.travelerId = input.travelerId;

		const where: Prisma.DocumentWhereInput = { ...base };
		if (input.kind.length > 0) where.kind = { in: input.kind };

		const { skip, take } = paginate(input);

		const [rows, total, kindGroups] = await Promise.all([
			scoped.document.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, LIST_SORTABLE, LIST_ORDER_FALLBACK),
				select: ENTRY_SELECT,
			}),
			scoped.document.count({ where }),
			scoped.document.groupBy({
				by: ["kind"],
				where: base,
				_count: { _all: true },
			}),
		]);

		return {
			rows: rows.map(serializeEntry),
			total,
			facetCounts: { kind: countsByKey(kindGroups, "kind") },
		};
	}

	async downloadUrl(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		id: string,
	) {
		const document = await this.readScoped(agencyId, role, viewerId, id);
		return signedDownloadUrl(document.pathname);
	}

	async update(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		input: UpdateDocumentInput,
	): Promise<DocumentEntry> {
		await this.readScoped(agencyId, role, viewerId, input.id);

		const scoped = agencyDb(this.db, agencyId);
		const data: Prisma.DocumentUpdateInput = {};
		if (input.kind !== undefined) data.kind = input.kind;
		if (input.filename !== undefined) data.filename = input.filename;

		const updated = await scoped.document.update({
			where: { id: input.id },
			data,
			select: ENTRY_SELECT,
		});

		return serializeEntry(updated);
	}

	async remove(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		id: string,
	): Promise<{ id: string }> {
		const document = await this.readOwnedOrManaged(
			agencyId,
			role,
			viewerId,
			id,
		);

		const scoped = agencyDb(this.db, agencyId);
		await scoped.document.delete({ where: { id } });
		await removeObject(document.pathname);

		return { id };
	}

	async removeMany(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		ids: string[],
	): Promise<BulkResult> {
		return runBulk(ids, (id) => this.remove(agencyId, role, viewerId, id));
	}

	private scopeFilter(
		role: AgencyRole,
		viewerId: string,
	): Prisma.DocumentWhereInput {
		if (canSeeMargins(role)) return {};
		return {
			OR: [
				{ uploadedById: viewerId },
				{ booking: { ownerId: viewerId } },
				{
					traveler: {
						bookingTravelers: { some: { booking: { ownerId: viewerId } } },
					},
				},
			],
		};
	}

	private async readScoped(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		id: string,
	): Promise<{ id: string; pathname: string; uploadedById: string }> {
		const scoped = agencyDb(this.db, agencyId);
		const document = await scoped.document.findFirst({
			where: { id, ...this.scopeFilter(role, viewerId) },
			select: { id: true, pathname: true, uploadedById: true },
		});
		if (!document) {
			throw new NotFoundException("That document does not exist.");
		}
		return document;
	}

	private async readOwnedOrManaged(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		id: string,
	): Promise<{ id: string; pathname: string; uploadedById: string }> {
		const document = await this.readScoped(agencyId, role, viewerId, id);
		if (document.uploadedById !== viewerId && !canSeeMargins(role)) {
			throw new ForbiddenException(
				"Only the person who uploaded this, or a manager, can remove it.",
			);
		}
		return document;
	}

	private async requireAnchor(
		scoped: ReturnType<typeof agencyDb>,
		input: Anchor,
	): Promise<void> {
		if (input.bookingId) {
			const found = await scoped.booking.findFirst({
				where: { id: input.bookingId },
				select: { id: true },
			});
			if (!found) throw new NotFoundException("That booking does not exist.");
		}
		if (input.travelerId) {
			const found = await scoped.traveler.findFirst({
				where: { id: input.travelerId },
				select: { id: true },
			});
			if (!found) throw new NotFoundException("That traveler does not exist.");
		}
	}
}

function serializeEntry(entry: Entry): DocumentEntry {
	return {
		id: entry.id,
		kind: entry.kind,
		filename: entry.filename,
		contentType: entry.contentType,
		sizeBytes: entry.sizeBytes,
		bookingId: entry.bookingId,
		travelerId: entry.travelerId,
		uploadedBy: entry.uploadedBy,
		createdAt: entry.createdAt.toISOString(),
	};
}

function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}
