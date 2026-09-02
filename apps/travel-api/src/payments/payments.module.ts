import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { TrpcModule } from "../trpc/trpc.module";
import { PaymentsRouter } from "./payments.router";
import { PaymentsService } from "./payments.service";

@Module({
	imports: [TrpcModule, CurrencyModule],
	providers: [PaymentsService, PaymentsRouter],
	exports: [PaymentsService],
})
export class PaymentsModule {}
