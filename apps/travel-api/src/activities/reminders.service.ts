import { Injectable, Logger } from "@nestjs/common";
import { ActivityType, agencyDb, type Db, type Prisma } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { sendReminderEmail } from "./reminder-mailer";
import { REMINDERS } from "./reminders-config";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SweepResult {
	agencies: number;
	reminded: number;
	created: number;
	skipped: number;
	mailed: number;
	mailFailed: number;
}

@Injectable()
export class RemindersService {
	private readonly logger = new Logger(RemindersService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async sweepAllAgencies(): Promise<SweepResult> {
		const agencies = await this.db.organization.findMany({
			select: { id: true },
			orderBy: { createdAt: "asc" },
			take: REMINDERS.sweep.maxAgenciesPerRun,
		});

		const total: SweepResult = {
			agencies: 0,
			reminded: 0,
			created: 0,
			skipped: 0,
			mailed: 0,
			mailFailed: 0,
		};

		for (const agency of agencies) {
			const one = await this.sweepAgency(agency.id);
			total.agencies += 1;
			total.reminded += one.reminded;
			total.created += one.created;
			total.skipped += one.skipped;
			total.mailed += one.mailed;
			total.mailFailed += one.mailFailed;
		}

		this.logger.log({ message: "Reminder sweep finished", ...total });

		return total;
	}

	private async sweepAgency(
		agencyId: string,
	): Promise<Omit<SweepResult, "agencies">> {
		const scoped = agencyDb(this.db, agencyId);
		const now = new Date();

		const one = {
			reminded: 0,
			created: 0,
			skipped: 0,
			mailed: 0,
			mailFailed: 0,
		};

		const overdueTasks = await scoped.activity.findMany({
			where: {
				type: ActivityType.TASK,
				completedAt: null,
				dueAt: { lt: now },
				assignedToId: { not: null },
				OR: [
					{ reminderSentAt: null },
					{
						reminderSentAt: {
							lt: new Date(now.getTime() - REMINDERS.task.resendAfterMs),
						},
					},
				],
			},
			take: REMINDERS.sweep.maxRowsPerAgency,
			select: {
				id: true,
				subject: true,
				dueAt: true,
				assignedTo: { select: { email: true, name: true } },
			},
		});

		for (const task of overdueTasks) {
			one.reminded += 1;
			if (!task.assignedTo?.email) continue;

			const delivery = await sendReminderEmail({
				to: task.assignedTo.email,
				subject: `Overdue task — ${task.subject ?? "a task is past due"}`,
				body: [
					`${task.assignedTo.name ?? "Hello"},`,
					"",
					`A task assigned to you is past its due date${
						task.dueAt ? ` (${task.dueAt.toISOString().slice(0, 10)})` : ""
					}:`,
					"",
					task.subject ?? "(no subject)",
				].join("\n"),
			});

			if (delivery.delivered) one.mailed += 1;
			else if (delivery.configured) one.mailFailed += 1;
		}

		if (overdueTasks.length > 0) {
			await scoped.activity.updateMany({
				where: { id: { in: overdueTasks.map((task) => task.id) } },
				data: { reminderSentAt: now },
			});
		}

		one.created += await this.createPaymentTasks(scoped, agencyId, now, one);
		one.created += await this.createDepartureTasks(scoped, agencyId, now, one);

		return one;
	}

	private async createPaymentTasks(
		scoped: ReturnType<typeof agencyDb>,
		agencyId: string,
		now: Date,
		tally: { skipped: number },
	): Promise<number> {
		const payments = await scoped.payment.findMany({
			where: {
				status: "SCHEDULED",
				dueDate: { lt: now },
				booking: { ownerId: { not: null } },
			},
			take: REMINDERS.sweep.maxRowsPerAgency,
			select: {
				id: true,
				dueDate: true,
				bookingId: true,
				booking: { select: { folio: true, ownerId: true } },
			},
		});

		if (payments.length === 0) return 0;

		const data: Prisma.ActivityCreateManyInput[] = payments.map((payment) => ({
			agencyId,
			type: ActivityType.TASK,
			subject: `Overdue payment on ${payment.booking.folio}`,
			bookingId: payment.bookingId,
			createdById: payment.booking.ownerId as string,
			assignedToId: payment.booking.ownerId,
			dueAt: payment.dueDate,
			occurredAt: now,
			sourceKey: `payment-overdue:${payment.id}`,
		}));

		const result = await scoped.activity.createMany({
			data,
			skipDuplicates: true,
		});

		tally.skipped += data.length - result.count;

		return result.count;
	}

	private async createDepartureTasks(
		scoped: ReturnType<typeof agencyDb>,
		agencyId: string,
		now: Date,
		tally: { skipped: number },
	): Promise<number> {
		const windowEnd = new Date(
			now.getTime() + REMINDERS.departure.windowDays * DAY_MS,
		);

		const bookings = await scoped.booking.findMany({
			where: {
				archivedAt: null,
				status: { not: "CANCELLED" },
				travelStartDate: { gte: now, lt: windowEnd },
				ownerId: { not: null },
			},
			take: REMINDERS.sweep.maxRowsPerAgency,
			select: {
				id: true,
				folio: true,
				ownerId: true,
				travelStartDate: true,
			},
		});

		if (bookings.length === 0) return 0;

		const data: Prisma.ActivityCreateManyInput[] = bookings.map((booking) => ({
			agencyId,
			type: ActivityType.TASK,
			subject: `Trip departs soon — ${booking.folio}`,
			bookingId: booking.id,
			createdById: booking.ownerId as string,
			assignedToId: booking.ownerId,
			dueAt: booking.travelStartDate,
			occurredAt: now,
			sourceKey: `departure:${booking.id}`,
		}));

		const result = await scoped.activity.createMany({
			data,
			skipDuplicates: true,
		});

		tally.skipped += data.length - result.count;

		return result.count;
	}
}
