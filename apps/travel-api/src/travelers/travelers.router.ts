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
	setLoyaltyInput,
	travelerArchiveResultOutput,
	travelerBulkInput,
	travelerBulkResultOutput,
	travelerCreateInput,
	travelerDetailOutput,
	travelerIdInput,
	travelerListInput,
	travelerListOutput,
	travelerOptionOutput,
	travelerOptionsInput,
	travelerSummaryOutput,
	travelerUpdateArgs,
} from "./travelers.contracts";
import { TravelersService } from "./travelers.service";

@Router({ alias: "travelers" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class TravelersRouter {
	constructor(
		@Inject(TravelersService) private readonly travelers: TravelersService,
	) {}

	@Query({
		input: travelerListInput,
		output: travelerListOutput,
		meta: restMeta("POST", "/travelers/search", ["Travelers"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof travelerListInput>,
	) {
		return this.travelers.list(ctx.agencyId, input);
	}

	@Query({
		input: travelerIdInput,
		output: travelerDetailOutput,
		meta: restMeta("GET", "/travelers/{id}", ["Travelers"]),
	})
	async byId(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.travelers.byId(ctx.agencyId, id);
	}

	@Query({
		input: travelerOptionsInput,
		output: travelerOptionOutput,
		meta: restMeta("GET", "/travelers/options", ["Travelers"]),
	})
	async options(@Ctx() ctx: AgencyTrpcContext, @Input("q") q: string) {
		return this.travelers.options(ctx.agencyId, q);
	}

	@Mutation({
		input: travelerCreateInput,
		output: travelerSummaryOutput,
		meta: restMeta("POST", "/travelers", ["Travelers"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof travelerCreateInput>,
	) {
		return this.travelers.create(ctx.agencyId, input);
	}

	@Mutation({
		input: travelerUpdateArgs,
		output: travelerSummaryOutput,
		meta: restMeta("PATCH", "/travelers/{id}", ["Travelers"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof travelerUpdateArgs>,
	) {
		return this.travelers.update(ctx.agencyId, input.id, input.data);
	}

	@Mutation({
		input: setLoyaltyInput,
		output: travelerDetailOutput,
		meta: restMeta("PUT", "/travelers/{id}/loyalty", ["Travelers"]),
	})
	async setLoyalty(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setLoyaltyInput>,
	) {
		return this.travelers.setLoyalty(ctx.agencyId, input);
	}

	@Mutation({
		input: travelerIdInput,
		output: travelerArchiveResultOutput,
		meta: restMeta("POST", "/travelers/{id}/archive", ["Travelers"]),
	})
	async archive(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.travelers.archive(ctx.agencyId, id);
	}

	@Mutation({
		input: travelerIdInput,
		output: travelerArchiveResultOutput,
		meta: restMeta("POST", "/travelers/{id}/restore", ["Travelers"]),
	})
	async restore(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.travelers.restore(ctx.agencyId, id);
	}

	@Mutation({
		input: travelerIdInput,
		output: travelerArchiveResultOutput,
		meta: restMeta("DELETE", "/travelers/{id}", ["Travelers"]),
	})
	async purge(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.travelers.purge(ctx.agencyId, id);
	}

	@Mutation({
		input: travelerBulkInput,
		output: travelerBulkResultOutput,
		meta: restMeta("POST", "/travelers/bulk-archive", ["Travelers"]),
	})
	async bulkArchive(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.travelers.bulkArchive(ctx.agencyId, ids);
	}

	@Mutation({
		input: travelerBulkInput,
		output: travelerBulkResultOutput,
		meta: restMeta("POST", "/travelers/bulk-restore", ["Travelers"]),
	})
	async bulkRestore(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.travelers.bulkRestore(ctx.agencyId, ids);
	}

	@Mutation({
		input: travelerBulkInput,
		output: travelerBulkResultOutput,
		meta: restMeta("POST", "/travelers/bulk-purge", ["Travelers"]),
	})
	async bulkPurge(@Ctx() ctx: AgencyTrpcContext, @Input("ids") ids: string[]) {
		return this.travelers.bulkPurge(ctx.agencyId, ids);
	}
}
