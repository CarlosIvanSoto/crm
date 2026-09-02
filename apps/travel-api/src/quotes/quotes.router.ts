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
	acceptQuoteInput,
	acceptQuoteOutput,
	quoteArchiveResultOutput,
	quoteBulkInput,
	quoteBulkResultOutput,
	quoteCreateInput,
	quoteDetailOutput,
	quoteIdInput,
	quoteListInput,
	quoteListOutput,
	quoteSummaryOutput,
	quoteUpdateArgs,
	setQuoteOptionsInput,
} from "./quotes.contracts";
import { QuotesService } from "./quotes.service";

@Router({ alias: "quotes" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class QuotesRouter {
	constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

	@Query({
		input: quoteListInput,
		output: quoteListOutput,
		meta: restMeta("POST", "/quotes/search", ["Quotes"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof quoteListInput>,
	) {
		return this.quotes.list(ctx.agencyId, input);
	}

	@Query({
		input: quoteIdInput,
		output: quoteDetailOutput,
		meta: restMeta("GET", "/quotes/{id}", ["Quotes"]),
	})
	async byId(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.quotes.byId(ctx.agencyId, id);
	}

	@Mutation({
		input: quoteCreateInput,
		output: quoteSummaryOutput,
		meta: restMeta("POST", "/quotes", ["Quotes"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof quoteCreateInput>,
	) {
		return this.quotes.create(ctx.agencyId, input);
	}

	@Mutation({
		input: quoteUpdateArgs,
		output: quoteSummaryOutput,
		meta: restMeta("PATCH", "/quotes/{id}", ["Quotes"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof quoteUpdateArgs>,
	) {
		return this.quotes.update(ctx.agencyId, input.id, input.data);
	}

	@Mutation({
		input: setQuoteOptionsInput,
		output: quoteDetailOutput,
		meta: restMeta("PUT", "/quotes/{id}/options", ["Quotes"]),
	})
	async setOptions(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setQuoteOptionsInput>,
	) {
		return this.quotes.setOptions(ctx.agencyId, input.id, input.options);
	}

	@Mutation({
		input: acceptQuoteInput,
		output: acceptQuoteOutput,
		meta: restMeta("POST", "/quotes/{id}/accept", ["Quotes"]),
	})
	async accept(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof acceptQuoteInput>,
	) {
		return this.quotes.accept(ctx.agencyId, input.id, input.optionId);
	}

	@Mutation({
		input: quoteIdInput,
		output: quoteArchiveResultOutput,
		meta: restMeta("POST", "/quotes/{id}/archive", ["Quotes"]),
	})
	async archive(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.quotes.archive(ctx.agencyId, id);
	}

	@Mutation({
		input: quoteIdInput,
		output: quoteArchiveResultOutput,
		meta: restMeta("POST", "/quotes/{id}/restore", ["Quotes"]),
	})
	async restore(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.quotes.restore(ctx.agencyId, id);
	}

	@Mutation({
		input: quoteIdInput,
		output: quoteArchiveResultOutput,
		meta: restMeta("DELETE", "/quotes/{id}", ["Quotes"]),
	})
	async purge(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.quotes.purge(ctx.agencyId, id);
	}

	@Mutation({
		input: quoteBulkInput,
		output: quoteBulkResultOutput,
		meta: restMeta("POST", "/quotes/bulk-archive", ["Quotes"]),
	})
	async bulkArchive(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.quotes.bulkArchive(ctx.agencyId, ids);
	}

	@Mutation({
		input: quoteBulkInput,
		output: quoteBulkResultOutput,
		meta: restMeta("POST", "/quotes/bulk-restore", ["Quotes"]),
	})
	async bulkRestore(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.quotes.bulkRestore(ctx.agencyId, ids);
	}

	@Mutation({
		input: quoteBulkInput,
		output: quoteBulkResultOutput,
		meta: restMeta("POST", "/quotes/bulk-purge", ["Quotes"]),
	})
	async bulkPurge(@Ctx() ctx: AgencyTrpcContext, @Input("ids") ids: string[]) {
		return this.quotes.bulkPurge(ctx.agencyId, ids);
	}
}
