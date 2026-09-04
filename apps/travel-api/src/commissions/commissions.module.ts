import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { TrpcModule } from "../trpc/trpc.module";
import { CommissionsRouter } from "./commissions.router";
import { CommissionsService } from "./commissions.service";

@Module({
	imports: [TrpcModule, CurrencyModule],
	providers: [CommissionsService, CommissionsRouter],
	exports: [CommissionsService],
})
export class CommissionsModule {}
