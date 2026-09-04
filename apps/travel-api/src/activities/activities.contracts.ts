import { ActivityType } from "@travel/db/enums";
import { z } from "zod";
import { bulkIdsInput } from "../travel/bulk";
import { listInput } from "../trpc/list-input";

const COMPOSABLE_TYPES = [
	ActivityType.NOTE,
	ActivityType.CALL,
	ActivityType.EMAIL,
	ActivityType.MEETING,
	ActivityType.TASK,
] as const;

const composableEnum = z.enum(COMPOSABLE_TYPES);

const activityTypeOutput = z.enum(
	Object.values(ActivityType) as [ActivityType, ...ActivityType[]],
);

const TIMELINE_FILTERS = [
	"all",
	"history",
	"notes",
	"upcoming",
	"done",
	"email",
	"meetings",
] as const;

export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

const TASK_WINDOWS = ["overdue", "today", "week", "all"] as const;

export type TaskWindow = (typeof TASK_WINDOWS)[number];

const anchorInput = {
	customerId: z.string().optional(),
	quoteId: z.string().optional(),
	bookingId: z.string().optional(),
};

export const timelineInput = z.object({
	...anchorInput,
	filter: z.enum(TIMELINE_FILTERS).default("all"),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(30),
});

export type TimelineInput = z.infer<typeof timelineInput>;

export const timelineCountsInput = z.object(anchorInput);

export type TimelineCountsInput = z.infer<typeof timelineCountsInput>;

export const activityCreateInput = z
	.object({
		type: composableEnum,
		subject: z.string().trim().max(200).optional(),
		body: z.string().trim().max(10000).optional(),
		occurredAt: z.string().datetime().optional(),
		dueAt: z.string().datetime().nullable().optional(),
		assignedToId: z.string().nullable().default(null),
		...anchorInput,
	})
	.refine((input) => input.customerId || input.quoteId || input.bookingId, {
		message: "An activity has to be about a customer, a quote or a booking.",
	})
	.refine(
		(input) => input.type !== ActivityType.TASK || Boolean(input.subject),
		{
			message: "A task needs a subject — it is the thing to do.",
			path: ["subject"],
		},
	);

export type ActivityCreateInput = z.infer<typeof activityCreateInput>;

export const completeInput = z.object({
	id: z.string(),
	completed: z.boolean().default(true),
});

export const completeManyInput = bulkIdsInput;

export const taskListInput = listInput.extend({
	window: z.enum(TASK_WINDOWS).default("all"),
	assignedToId: z.string().nullable().default(null),
	bookingId: z.string().nullable().default(null),
});

export type TaskListInput = z.infer<typeof taskListInput>;

export const assignInput = z.object({
	id: z.string(),
	assignedToId: z.string().nullable(),
});

export type AssignInput = z.infer<typeof assignInput>;

export const updateTaskInput = z.object({
	id: z.string(),
	subject: z.string().trim().max(200).optional(),
	body: z.string().trim().max(10000).nullable().optional(),
	dueAt: z.string().datetime().nullable().optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskInput>;

export const removeInput = z.object({ id: z.string() });

const activityAuthorOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

export const activityEntryOutput = z.object({
	id: z.string(),
	type: activityTypeOutput,
	subject: z.string().nullable(),
	body: z.string().nullable(),
	occurredAt: z.string().nullable(),
	dueAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	customerId: z.string().nullable(),
	quoteId: z.string().nullable(),
	bookingId: z.string().nullable(),
	createdAt: z.string(),
	createdBy: activityAuthorOutput,
	assignedTo: activityAuthorOutput.nullable(),
	reminderSentAt: z.string().nullable(),
	sourceKey: z.string().nullable(),
});

export type ActivityEntry = z.infer<typeof activityEntryOutput>;

export const timelineOutput = z.object({
	entries: z.array(activityEntryOutput),
	nextCursor: z.string().nullable(),
});

export type TimelineResult = z.infer<typeof timelineOutput>;

export const timelineCountsOutput = z.object({
	all: z.number(),
	notes: z.number(),
	upcoming: z.number(),
	done: z.number(),
	email: z.number(),
	meetings: z.number(),
});

export type TimelineCounts = z.infer<typeof timelineCountsOutput>;

const facetCountsOutput = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);

export const taskListOutput = z.object({
	rows: z.array(activityEntryOutput),
	total: z.number(),
	facetCounts: facetCountsOutput,
});

export type TaskListResult = z.infer<typeof taskListOutput>;

export const activityCreateOutput = activityEntryOutput;

export const completeOutput = activityEntryOutput;

export const bulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const removeOutput = z.object({ id: z.string() });
