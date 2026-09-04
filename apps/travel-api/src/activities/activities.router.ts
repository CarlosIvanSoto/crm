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
	assignInput,
	bulkResultOutput,
	completeInput,
	completeManyInput,
	completeOutput,
	removeInput,
	removeOutput,
	taskListInput,
	taskListOutput,
	timelineCountsInput,
	timelineCountsOutput,
	timelineInput,
	timelineOutput,
	updateTaskInput,
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
		input: taskListInput,
		output: taskListOutput,
		meta: restMeta("POST", "/activities/tasks/search", ["Activities"]),
	})
	async tasks(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof taskListInput>,
	) {
		return this.activities.tasks(ctx.agencyId, ctx.role, ctx.user.id, input);
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
		return this.activities.complete(
			ctx.agencyId,
			ctx.role,
			ctx.user.id,
			input.id,
			input.completed,
		);
	}

	@Mutation({
		input: completeManyInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/activities/complete-many", ["Activities"]),
	})
	async completeMany(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.activities.completeMany(
			ctx.agencyId,
			ctx.role,
			ctx.user.id,
			ids,
		);
	}

	@Mutation({
		input: assignInput,
		output: activityCreateOutput,
		meta: restMeta("POST", "/activities/{id}/assign", ["Activities"]),
	})
	async assign(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof assignInput>,
	) {
		return this.activities.assign(ctx.agencyId, ctx.role, ctx.user.id, input);
	}

	@Mutation({
		input: updateTaskInput,
		output: activityCreateOutput,
		meta: restMeta("PATCH", "/activities/{id}", ["Activities"]),
	})
	async updateTask(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof updateTaskInput>,
	) {
		return this.activities.updateTask(
			ctx.agencyId,
			ctx.role,
			ctx.user.id,
			input,
		);
	}

	@Mutation({
		input: removeInput,
		output: removeOutput,
		meta: restMeta("DELETE", "/activities/{id}", ["Activities"]),
	})
	async remove(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.activities.remove(ctx.agencyId, ctx.role, ctx.user.id, id);
	}
}
