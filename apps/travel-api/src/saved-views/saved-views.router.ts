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
	savedViewCreateInput,
	savedViewDeleteOutput,
	savedViewIdInput,
	savedViewListInput,
	savedViewListOutput,
	savedViewOutput,
	savedViewUpdateArgs,
} from "./saved-views.contracts";
import { SavedViewsService } from "./saved-views.service";

@Router({ alias: "savedViews" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class SavedViewsRouter {
	constructor(
		@Inject(SavedViewsService) private readonly savedViews: SavedViewsService,
	) {}

	@Query({
		input: savedViewListInput,
		output: savedViewListOutput,
		meta: restMeta("GET", "/saved-views", ["Saved Views"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof savedViewListInput>,
	) {
		return this.savedViews.list(ctx.agencyId, input.entity, ctx.user.id);
	}

	@Mutation({
		input: savedViewCreateInput,
		output: savedViewOutput,
		meta: restMeta("POST", "/saved-views", ["Saved Views"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof savedViewCreateInput>,
	) {
		return this.savedViews.create(ctx.agencyId, input, ctx.user.id);
	}

	@Mutation({
		input: savedViewUpdateArgs,
		output: savedViewOutput,
		meta: restMeta("PATCH", "/saved-views/{id}", ["Saved Views"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof savedViewUpdateArgs>,
	) {
		return this.savedViews.update(
			ctx.agencyId,
			input.id,
			input.data,
			ctx.user.id,
		);
	}

	@Mutation({
		input: savedViewIdInput,
		output: savedViewDeleteOutput,
		meta: restMeta("DELETE", "/saved-views/{id}", ["Saved Views"]),
	})
	async delete(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.savedViews.delete(ctx.agencyId, id, ctx.user.id);
	}
}
