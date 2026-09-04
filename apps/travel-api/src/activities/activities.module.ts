import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { ActivitiesRouter } from "./activities.router";
import { ActivitiesService } from "./activities.service";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";

@Module({
	imports: [TrpcModule],
	controllers: [RemindersController],
	providers: [ActivitiesService, ActivitiesRouter, RemindersService],
	exports: [ActivitiesService],
})
export class ActivitiesModule {}
