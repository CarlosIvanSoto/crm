import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { TravelersRouter } from "./travelers.router";
import { TravelersService } from "./travelers.service";

@Module({
	imports: [TrpcModule],
	providers: [TravelersService, TravelersRouter],
	exports: [TravelersService],
})
export class TravelersModule {}
