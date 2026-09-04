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
	createShareInput,
	revokeShareOutput,
	sendQuoteInput,
	sendQuoteOutput,
	shareQuoteIdInput,
	shareStatusOutput,
} from "./quote-share.contracts";
import { QuoteShareService } from "./quote-share.service";

@Router({ alias: "quoteShare" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class QuoteShareRouter {
	constructor(
		@Inject(QuoteShareService)
		private readonly quoteShare: QuoteShareService,
	) {}

	@Query({
		input: shareQuoteIdInput,
		output: shareStatusOutput,
		meta: restMeta("GET", "/quotes/{quoteId}/share", ["Quotes"]),
	})
	async status(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("quoteId") quoteId: string,
	) {
		return this.quoteShare.status(ctx.agencyId, quoteId);
	}

	@Mutation({
		input: createShareInput,
		output: shareStatusOutput,
		meta: restMeta("POST", "/quotes/{quoteId}/share", ["Quotes"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof createShareInput>,
	) {
		return this.quoteShare.create(ctx.agencyId, ctx.user.id, input);
	}

	@Mutation({
		input: shareQuoteIdInput,
		output: revokeShareOutput,
		meta: restMeta("DELETE", "/quotes/{quoteId}/share", ["Quotes"]),
	})
	async revoke(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("quoteId") quoteId: string,
	) {
		return this.quoteShare.revoke(ctx.agencyId, quoteId);
	}

	@Mutation({
		input: sendQuoteInput,
		output: sendQuoteOutput,
		meta: restMeta("POST", "/quotes/{quoteId}/send", ["Quotes"]),
	})
	async send(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof sendQuoteInput>,
	) {
		return this.quoteShare.send(ctx.agencyId, ctx.user.id, input);
	}
}
