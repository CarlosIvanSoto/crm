import {
	Injectable,
	Logger,
	type OnApplicationShutdown,
	type OnModuleInit,
} from "@nestjs/common";
import { setPrismaLogSink } from "@travel/db";

@Injectable()
export class PrismaLogBridge implements OnModuleInit, OnApplicationShutdown {
	private readonly logger = new Logger("Prisma");

	onModuleInit(): void {
		setPrismaLogSink(({ level, message, target, durationMs }) => {
			const payload =
				durationMs === undefined
					? { message, target }
					: { message, target, durationMs };

			if (level === "error") {
				this.logger.error(payload);
				return;
			}

			if (level === "warn") {
				this.logger.warn(payload);
				return;
			}

			this.logger.debug(payload);
		});
	}

	onApplicationShutdown(): void {
		setPrismaLogSink(null);
	}
}
