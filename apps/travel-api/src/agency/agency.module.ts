import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { AgencyRouter } from "./agency.router";
import { AgencyService } from "./agency.service";

@Module({
	imports: [TrpcModule],
	providers: [AgencyService, AgencyRouter],
	exports: [AgencyService],
})
export class AgencyModule {}
