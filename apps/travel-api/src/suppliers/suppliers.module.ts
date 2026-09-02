import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { SuppliersRouter } from "./suppliers.router";
import { SuppliersService } from "./suppliers.service";

@Module({
	imports: [TrpcModule],
	providers: [SuppliersService, SuppliersRouter],
	exports: [SuppliersService],
})
export class SuppliersModule {}
