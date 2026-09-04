import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { type AgencyRole, canSeeMargins } from "@travel/auth";
import { ActivityType, agencyDb, type Db, type Prisma } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { ActivityStampService } from "../travel/activity-stamp.service";
import { type BulkResult, requireAgencyMember, runBulk } from "../travel/bulk";
import { blankToNull } from "../travel/values";
import {
	countsByKey,
	type FacetCount,
	type OrderByColumns,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	ActivityCreateInput,
	ActivityEntry,
	AssignInput,
	TaskListInput,
	TaskListResult,
	TaskWindow,
	TimelineCounts,
	TimelineCountsInput,
	TimelineFilter,
	TimelineInput,
	TimelineResult,
	UpdateTaskInput,
} from "./activities.contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

const TASK_WINDOWS = ["overdue", "today", "week", "all"] as const;

const AUTHOR_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const ENTRY_SELECT = {
	id: true,
	type: true,
	subject: true,
	body: true,
	occurredAt: true,
	dueAt: true,
	completedAt: true,
	customerId: true,
	quoteId: true,
	bookingId: true,
	createdAt: true,
	createdBy: { select: AUTHOR_SELECT },
	assignedTo: { select: AUTHOR_SELECT },
	reminderSentAt: true,
	sourceKey: true,
} as const;

const NOTE_TYPES = [
	ActivityType.NOTE,
	ActivityType.CALL,
	ActivityType.EMAIL,
	ActivityType.MEETING,
];

const TASK_SORTABLE: OrderByColumns<Prisma.ActivityOrderByWithRelationInput[]> =
	{
		dueAt: (dir) => [
			{ dueAt: { sort: dir, nulls: "last" } },
			{ createdAt: "desc" },
		],
		createdAt: (dir) => [{ createdAt: dir }],
	};

const TASK_ORDER_FALLBACK: Prisma.ActivityOrderByWithRelationInput[] = [
	{ dueAt: { sort: "asc", nulls: "last" } },
	{ createdAt: "desc" },
];

@Injectable()
export class ActivitiesService {
	private readonly logger = new Logger(ActivitiesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
	) {}

	async timeline(
		agencyId: string,
		input: TimelineInput,
	): Promise<TimelineResult> {
		const scoped = agencyDb(this.db, agencyId);
		const where: Prisma.ActivityWhereInput = {
			...this.anchor(input),
			...filterClause(input.filter),
		};

		const rows = await scoped.activity.findMany({
			where,
			take: input.limit + 1,
			cursor: input.cursor ? { id: input.cursor } : undefined,
			skip: input.cursor ? 1 : undefined,
			orderBy: [
				{ occurredAt: { sort: "desc", nulls: "last" } },
				{ id: "desc" },
			],
			select: ENTRY_SELECT,
		});

		const hasMore = rows.length > input.limit;
		const entries = hasMore ? rows.slice(0, input.limit) : rows;

		return {
			entries: entries.map(serializeEntry),
			nextCursor: hasMore ? (entries[entries.length - 1]?.id ?? null) : null,
		};
	}

	async timelineCounts(
		agencyId: string,
		input: TimelineCountsInput,
	): Promise<TimelineCounts> {
		const scoped = agencyDb(this.db, agencyId);
		const anchor = this.anchor(input);

		const [all, notes, upcoming, done, email, meetings] = await Promise.all([
			scoped.activity.count({ where: anchor }),
			scoped.activity.count({ where: { ...anchor, ...filterClause("notes") } }),
			scoped.activity.count({
				where: { ...anchor, ...filterClause("upcoming") },
			}),
			scoped.activity.count({ where: { ...anchor, ...filterClause("done") } }),
			scoped.activity.count({ where: { ...anchor, ...filterClause("email") } }),
			scoped.activity.count({
				where: { ...anchor, ...filterClause("meetings") },
			}),
		]);

		return { all, notes, upcoming, done, email, meetings };
	}

	async create(
		agencyId: string,
		input: ActivityCreateInput,
		actingUserId: string,
	): Promise<ActivityEntry> {
		const scoped = agencyDb(this.db, agencyId);
		await this.requireAnchors(scoped, input);

		const isTask = input.type === ActivityType.TASK;

		let assignedToId: string | null = null;
		if (isTask) {
			assignedToId = input.assignedToId ?? actingUserId;
			if (input.assignedToId) {
				await requireAgencyMember(this.db, agencyId, input.assignedToId);
			}
		}

		const activity = await scoped.activity.create({
			data: {
				agencyId,
				type: input.type,
				subject: blankToNull(input.subject ?? ""),
				body: blankToNull(input.body ?? ""),
				occurredAt: parseDate(input.occurredAt) ?? new Date(),
				dueAt: isTask ? parseDate(input.dueAt) : null,
				customerId: input.customerId ?? null,
				quoteId: input.quoteId ?? null,
				bookingId: input.bookingId ?? null,
				createdById: actingUserId,
				assignedToId,
			},
			select: ENTRY_SELECT,
		});

		const customerId = await this.stampCustomerId(scoped, input);
		await this.stamp.touch(
			agencyId,
			{ customerId, bookingId: input.bookingId ?? null },
			activity.createdAt,
		);

		this.logger.log({
			message: "Activity logged",
			agencyId,
			activityId: activity.id,
			type: activity.type,
		});

		return serializeEntry(activity);
	}

	async complete(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		id: string,
		completed: boolean,
	): Promise<ActivityEntry> {
		const scoped = agencyDb(this.db, agencyId);
		const task = await this.readTask(scoped, id);
		this.requireManagerOrAssignee(role, viewerId, task.assignedToId);

		const updated = await scoped.activity.update({
			where: { id },
			data: { completedAt: completed ? new Date() : null },
			select: ENTRY_SELECT,
		});

		return serializeEntry(updated);
	}

	async completeMany(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		ids: string[],
	): Promise<BulkResult> {
		return runBulk(ids, (id) =>
			this.complete(agencyId, role, viewerId, id, true),
		);
	}

	async tasks(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		input: TaskListInput,
	): Promise<TaskListResult> {
		const scoped = agencyDb(this.db, agencyId);

		const viewerScope = canSeeMargins(role) ? null : viewerId;
		const assignedToId = viewerScope ?? input.assignedToId;

		const base: Prisma.ActivityWhereInput = {
			type: ActivityType.TASK,
			completedAt: null,
		};
		if (assignedToId) base.assignedToId = assignedToId;
		if (input.bookingId) base.bookingId = input.bookingId;

		const where: Prisma.ActivityWhereInput = {
			...base,
			...windowClause(input.window),
		};

		const { skip, take } = paginate(input);

		const [rows, total, windowCounts, assigneeGroups] = await Promise.all([
			scoped.activity.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, TASK_SORTABLE, TASK_ORDER_FALLBACK),
				select: ENTRY_SELECT,
			}),
			scoped.activity.count({ where }),
			Promise.all(
				TASK_WINDOWS.map((option) =>
					scoped.activity.count({
						where: { ...base, ...windowClause(option) },
					}),
				),
			),
			scoped.activity.groupBy({
				by: ["assignedToId"],
				where: base,
				_count: { _all: true },
			}),
		]);

		const windowFacet: FacetCount = {};
		TASK_WINDOWS.forEach((option, index) => {
			windowFacet[option] = windowCounts[index] ?? 0;
		});

		return {
			rows: rows.map(serializeEntry),
			total,
			facetCounts: {
				window: windowFacet,
				assignedTo: countsByKey(assigneeGroups, "assignedToId"),
			},
		};
	}

	async assign(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		input: AssignInput,
	): Promise<ActivityEntry> {
		const scoped = agencyDb(this.db, agencyId);
		const task = await this.readTask(scoped, input.id);
		this.requireManagerOrAssignee(role, viewerId, task.assignedToId);

		if (input.assignedToId) {
			await requireAgencyMember(this.db, agencyId, input.assignedToId);
		}

		const updated = await scoped.activity.update({
			where: { id: input.id },
			data: { assignedToId: input.assignedToId },
			select: ENTRY_SELECT,
		});

		return serializeEntry(updated);
	}

	async updateTask(
		agencyId: string,
		role: AgencyRole,
		viewerId: string,
		input: UpdateTaskInput,
	): Promise<ActivityEntry> {
		const scoped = agencyDb(this.db, agencyId);
		const task = await this.readTask(scoped, input.id);
		this.requireManagerOrAssignee(role, viewerId, task.assignedToId);

		const data: Prisma.ActivityUpdateInput = {};
		if (input.subject !== undefined) {
			data.subject = blankToNull(input.subject);
		}
		if (input.body !== undefined) {
			data.body = input.body === null ? null : blankToNull(input.body);
		}
		if (input.dueAt !== undefined) {
			data.dueAt = parseDate(input.dueAt);
		}

		const updated = await scoped.activity.update({
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
		const scoped = agencyDb(this.db, agencyId);
		const task = await this.readTask(scoped, id);
		this.requireManagerOrAssignee(role, viewerId, task.assignedToId);

		await scoped.activity.delete({ where: { id } });

		return { id };
	}

	private async readTask(
		scoped: ReturnType<typeof agencyDb>,
		id: string,
	): Promise<{ type: ActivityType; assignedToId: string | null }> {
		const task = await scoped.activity.findFirst({
			where: { id },
			select: { type: true, assignedToId: true },
		});

		if (!task) {
			throw new NotFoundException(`No activity with id ${id}.`);
		}

		if (task.type !== ActivityType.TASK) {
			throw new BadRequestException("Only tasks can be changed here.");
		}

		return task;
	}

	private requireManagerOrAssignee(
		role: AgencyRole,
		viewerId: string,
		assignedToId: string | null,
	): void {
		if (canSeeMargins(role)) return;
		if (assignedToId === viewerId) return;
		throw new ForbiddenException(
			"Only the assignee or a manager can change this task.",
		);
	}

	private anchor(input: TimelineCountsInput): Prisma.ActivityWhereInput {
		if (input.bookingId) return { bookingId: input.bookingId };
		if (input.quoteId) return { quoteId: input.quoteId };
		if (input.customerId) return { customerId: input.customerId };
		throw new BadRequestException(
			"A timeline needs a customer, a quote or a booking.",
		);
	}

	private async requireAnchors(
		scoped: ReturnType<typeof agencyDb>,
		input: ActivityCreateInput,
	): Promise<void> {
		if (input.customerId) {
			const found = await scoped.customer.findFirst({
				where: { id: input.customerId },
				select: { id: true },
			});
			if (!found) throw new NotFoundException("That customer does not exist.");
		}
		if (input.quoteId) {
			const found = await scoped.quote.findFirst({
				where: { id: input.quoteId },
				select: { id: true },
			});
			if (!found) throw new NotFoundException("That quote does not exist.");
		}
		if (input.bookingId) {
			const found = await scoped.booking.findFirst({
				where: { id: input.bookingId },
				select: { id: true },
			});
			if (!found) throw new NotFoundException("That booking does not exist.");
		}
	}

	private async stampCustomerId(
		scoped: ReturnType<typeof agencyDb>,
		input: ActivityCreateInput,
	): Promise<string | null> {
		if (input.customerId) return input.customerId;

		if (input.bookingId) {
			const booking = await scoped.booking.findFirst({
				where: { id: input.bookingId },
				select: { customerId: true },
			});
			return booking?.customerId ?? null;
		}

		if (input.quoteId) {
			const quote = await scoped.quote.findFirst({
				where: { id: input.quoteId },
				select: { customerId: true },
			});
			return quote?.customerId ?? null;
		}

		return null;
	}
}

function filterClause(filter: TimelineFilter): Prisma.ActivityWhereInput {
	switch (filter) {
		case "notes":
			return { type: { in: NOTE_TYPES } };
		case "upcoming":
			return { type: ActivityType.TASK, completedAt: null };
		case "done":
			return { type: ActivityType.TASK, completedAt: { not: null } };
		case "history":
			return { NOT: { type: ActivityType.TASK, completedAt: null } };
		case "email":
			return { type: ActivityType.EMAIL };
		case "meetings":
			return { type: ActivityType.MEETING };
		default:
			return {};
	}
}

function windowClause(window: TaskWindow): Prisma.ActivityWhereInput {
	if (window === "all") return {};

	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);

	if (window === "overdue") return { dueAt: { lt: startOfToday } };
	if (window === "today") {
		return { dueAt: { lt: new Date(startOfToday.getTime() + DAY_MS) } };
	}
	return { dueAt: { lt: new Date(startOfToday.getTime() + 7 * DAY_MS) } };
}

type Entry = Prisma.ActivityGetPayload<{ select: typeof ENTRY_SELECT }>;

function serializeEntry(entry: Entry): ActivityEntry {
	return {
		id: entry.id,
		type: entry.type,
		subject: entry.subject,
		body: entry.body,
		occurredAt: entry.occurredAt?.toISOString() ?? null,
		dueAt: entry.dueAt?.toISOString() ?? null,
		completedAt: entry.completedAt?.toISOString() ?? null,
		customerId: entry.customerId,
		quoteId: entry.quoteId,
		bookingId: entry.bookingId,
		createdAt: entry.createdAt.toISOString(),
		createdBy: entry.createdBy,
		assignedTo: entry.assignedTo,
		reminderSentAt: entry.reminderSentAt?.toISOString() ?? null,
		sourceKey: entry.sourceKey,
	};
}

function parseDate(value: string | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`"${value}" is not a date.`);
	}
	return date;
}
