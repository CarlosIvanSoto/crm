import { Injectable, Logger } from "@nestjs/common";
import type { Db } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";

export type ActivityTarget = {
	customerId?: string | null;
	bookingId?: string | null;
};

@Injectable()
export class ActivityStampService {
	private readonly logger = new Logger(ActivityStampService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async touch(
		agencyId: string,
		target: ActivityTarget,
		at: Date,
	): Promise<void> {
		const stale = {
			OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: at } }],
		};

		await Promise.all([
			target.customerId
				? this.db.customer.updateMany({
						where: { id: target.customerId, agencyId, ...stale },
						data: { lastActivityAt: at },
					})
				: null,
			target.bookingId
				? this.db.booking.updateMany({
						where: { id: target.bookingId, agencyId, ...stale },
						data: { lastActivityAt: at },
					})
				: null,
		]);
	}

	async recompute(agencyId: string, target: ActivityTarget): Promise<void> {
		try {
			if (target.customerId) {
				const { _max } = await this.db.activity.aggregate({
					where: { agencyId, customerId: target.customerId },
					_max: { createdAt: true },
				});
				await this.db.customer.updateMany({
					where: { id: target.customerId, agencyId },
					data: { lastActivityAt: _max.createdAt },
				});
			}

			if (target.bookingId) {
				const { _max } = await this.db.activity.aggregate({
					where: { agencyId, bookingId: target.bookingId },
					_max: { createdAt: true },
				});
				await this.db.booking.updateMany({
					where: { id: target.bookingId, agencyId },
					data: { lastActivityAt: _max.createdAt },
				});
			}
		} catch (error) {
			this.logger.error(
				{
					message: "An activity was removed but its stamps were not recomputed",
					agencyId,
					...target,
				},
				error instanceof Error ? error.stack : String(error),
			);
		}
	}
}
