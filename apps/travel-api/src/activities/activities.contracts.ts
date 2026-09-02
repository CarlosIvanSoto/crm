import { ActivityType } from "@travel/db/enums";
import { z } from "zod";

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

export const myTasksInput = z.object({
	window: z.enum(["overdue", "upcoming", "all"]).default("all"),
	limit: z.number().int().min(1).max(100).default(25),
});

export type MyTasksInput = z.infer<typeof myTasksInput>;

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

export const myTasksOutput = z.array(activityEntryOutput);

export const activityCreateOutput = activityEntryOutput;

export const completeOutput = activityEntryOutput;
