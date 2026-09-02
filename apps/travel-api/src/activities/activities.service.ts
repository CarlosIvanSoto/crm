import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { ActivityType, agencyDb, type Db, type Prisma } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { ActivityStampService } from "../travel/activity-stamp.service";
import { blankToNull } from "../travel/values";
import type {
	ActivityCreateInput,
	ActivityEntry,
	MyTasksInput,
	TimelineCounts,
	TimelineCountsInput,
	TimelineFilter,
	TimelineInput,
	TimelineResult,
} from "./activities.contracts";

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
} as const;

const NOTE_TYPES = [
	ActivityType.NOTE,
	ActivityType.CALL,
	ActivityType.EMAIL,
	ActivityType.MEETING,
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
		id: string,
		completed: boolean,
	): Promise<ActivityEntry> {
		const scoped = agencyDb(this.db, agencyId);
		const activity = await scoped.activity.findFirst({
			where: { id },
			select: { type: true },
		});

		if (!activity) {
			throw new NotFoundException(`No activity with id ${id}.`);
		}

		if (activity.type !== ActivityType.TASK) {
			throw new BadRequestException("Only tasks can be completed.");
		}

		const updated = await scoped.activity.update({
			where: { id },
			data: { completedAt: completed ? new Date() : null },
			select: ENTRY_SELECT,
		});

		return serializeEntry(updated);
	}

	async myTasks(
		agencyId: string,
		input: MyTasksInput,
		actingUserId: string,
	): Promise<ActivityEntry[]> {
		const scoped = agencyDb(this.db, agencyId);
		const now = new Date();
		const where: Prisma.ActivityWhereInput = {
			type: ActivityType.TASK,
			completedAt: null,
			createdById: actingUserId,
		};

		if (input.window === "overdue") where.dueAt = { lt: now };
		if (input.window === "upcoming") where.dueAt = { gte: now };

		const tasks = await scoped.activity.findMany({
			where,
			take: input.limit,
			orderBy: [
				{ dueAt: { sort: "asc", nulls: "last" } },
				{ createdAt: "desc" },
			],
			select: ENTRY_SELECT,
		});

		return tasks.map(serializeEntry);
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
