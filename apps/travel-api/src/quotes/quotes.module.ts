import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { TrpcModule } from "../trpc/trpc.module";
import { QuotesRouter } from "./quotes.router";
import { QuotesService } from "./quotes.service";

@Module({
	imports: [TrpcModule, CurrencyModule],
	providers: [QuotesService, QuotesRouter],
	exports: [QuotesService],
})
export class QuotesModule {}
