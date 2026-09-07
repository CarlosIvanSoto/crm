import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { AgencyTrpcContext } from "../trpc/context.types";
import { AgencyMiddleware } from "../trpc/middlewares/agency.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	conversationLatestOutput,
	conversationListOutput,
	conversationQuoteIdInput,
} from "./agent-conversation.contracts";
import { AgentConversationService } from "./agent-conversation.service";

@Router({ alias: "agentConversation" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class AgentConversationRouter {
	constructor(
		@Inject(AgentConversationService)
		private readonly conversations: AgentConversationService,
	) {}

	@Query({
		input: conversationQuoteIdInput,
		output: conversationListOutput,
		meta: restMeta("GET", "/quotes/{quoteId}/agent-conversations", ["Quotes"]),
	})
	async list(@Ctx() ctx: AgencyTrpcContext, @Input("quoteId") quoteId: string) {
		return this.conversations.list(ctx.agencyId, quoteId);
	}

	@Query({
		input: conversationQuoteIdInput,
		output: conversationLatestOutput,
		meta: restMeta("GET", "/quotes/{quoteId}/agent-conversations/latest", [
			"Quotes",
		]),
	})
	async latest(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("quoteId") quoteId: string,
	) {
		return this.conversations.latest(ctx.agencyId, quoteId);
	}
}
