import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { TrpcModule } from "../trpc/trpc.module";
import { BookingsRouter } from "./bookings.router";
import { BookingsService } from "./bookings.service";

@Module({
	imports: [TrpcModule, CurrencyModule],
	providers: [BookingsService, BookingsRouter],
	exports: [BookingsService],
})
export class BookingsModule {}
