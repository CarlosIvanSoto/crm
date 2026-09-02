import { Global, Module } from "@nestjs/common";
import { ActivityStampService } from "./activity-stamp.service";

@Global()
@Module({
	providers: [ActivityStampService],
	exports: [ActivityStampService],
})
export class TravelModule {}
