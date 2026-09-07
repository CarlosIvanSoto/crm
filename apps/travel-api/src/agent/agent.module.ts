import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { AgentConversationRouter } from "./agent-conversation.router";
import { AgentConversationService } from "./agent-conversation.service";
import { QuoteFollowupController } from "./quote-followup.controller";
import { QuoteFollowupService } from "./quote-followup.service";

@Module({
	imports: [TrpcModule],
	controllers: [QuoteFollowupController],
	providers: [
		QuoteFollowupService,
		AgentConversationService,
		AgentConversationRouter,
	],
})
export class AgentModule {}
