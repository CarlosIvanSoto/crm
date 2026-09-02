import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AgencyTrpcContext } from "../trpc/context.types";
import { AgencyMiddleware } from "../trpc/middlewares/agency.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	activityCreateInput,
	activityCreateOutput,
	completeInput,
	completeOutput,
	myTasksInput,
	myTasksOutput,
	timelineCountsInput,
	timelineCountsOutput,
	timelineInput,
	timelineOutput,
} from "./activities.contracts";
import { ActivitiesService } from "./activities.service";

@Router({ alias: "activities" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class ActivitiesRouter {
	constructor(
		@Inject(ActivitiesService) private readonly activities: ActivitiesService,
	) {}

	@Query({
		input: timelineInput,
		output: timelineOutput,
		meta: restMeta("POST", "/activities/timeline", ["Activities"]),
	})
	async timeline(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof timelineInput>,
	) {
		return this.activities.timeline(ctx.agencyId, input);
	}

	@Query({
		input: timelineCountsInput,
		output: timelineCountsOutput,
		meta: restMeta("POST", "/activities/timeline/counts", ["Activities"]),
	})
	async timelineCounts(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof timelineCountsInput>,
	) {
		return this.activities.timelineCounts(ctx.agencyId, input);
	}

	@Query({
		input: myTasksInput,
		output: myTasksOutput,
		meta: restMeta("GET", "/activities/my-tasks", ["Activities"]),
	})
	async myTasks(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof myTasksInput>,
	) {
		return this.activities.myTasks(ctx.agencyId, input, ctx.user.id);
	}

	@Mutation({
		input: activityCreateInput,
		output: activityCreateOutput,
		meta: restMeta("POST", "/activities", ["Activities"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof activityCreateInput>,
	) {
		return this.activities.create(ctx.agencyId, input, ctx.user.id);
	}

	@Mutation({
		input: completeInput,
		output: completeOutput,
		meta: restMeta("POST", "/activities/{id}/complete", ["Activities"]),
	})
	async complete(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof completeInput>,
	) {
		return this.activities.complete(ctx.agencyId, input.id, input.completed);
	}
}
