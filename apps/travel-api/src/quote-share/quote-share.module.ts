import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { PublicQuoteRouter } from "./public-quote.router";
import { QuoteShareRouter } from "./quote-share.router";
import { QuoteShareService } from "./quote-share.service";

@Module({
	imports: [TrpcModule],
	providers: [QuoteShareService, QuoteShareRouter, PublicQuoteRouter],
	exports: [QuoteShareService],
})
export class QuoteShareModule {}
