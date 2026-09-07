import { db } from "../../src/client";
import type { Prisma } from "../../src/generated/prisma/client";
import {
	CALL_SUBJECTS,
	EMAIL_SUBJECTS,
	MEETING_SUBJECTS,
	NOTE_BODIES,
	TASK_SUBJECTS,
} from "./catalog";
import type { AgencyBag, SeededBooking, SeededQuote } from "./context";
import { daysFromNow, integer, isoDay, pick, type Rng } from "./random";
import type { SeededShare } from "./shares";

const TIMELINE_TYPES = ["NOTE", "CALL", "EMAIL", "MEETING"] as const;

function subjectFor(type: string, rng: Rng) {
	if (type === "NOTE") return { subject: "Nota", body: pick(rng, NOTE_BODIES) };
	if (type === "CALL")
		return { subject: pick(rng, CALL_SUBJECTS), body: pick(rng, NOTE_BODIES) };
	if (type === "EMAIL")
		return {
			subject: pick(rng, EMAIL_SUBJECTS),
			body: "Correo enviado al cliente.",
		};
	return { subject: pick(rng, MEETING_SUBJECTS), body: "Reunión registrada." };
}

interface TaskSpec {
	dueInDays: number | null;
	completed: boolean;
	assignee: "owner" | "agent1" | "agent2" | null;
	reminded?: boolean;
}

const TASK_SPECS: TaskSpec[] = [
	{ dueInDays: -5, completed: false, assignee: "agent1", reminded: true },
	{ dueInDays: -1, completed: false, assignee: "agent2" },
	{ dueInDays: 0, completed: false, assignee: "owner" },
	{ dueInDays: 3, completed: false, assignee: "agent1" },
	{ dueInDays: 6, completed: false, assignee: "agent2" },
	{ dueInDays: 20, completed: false, assignee: "owner" },
	{ dueInDays: null, completed: false, assignee: null },
	{ dueInDays: -8, completed: true, assignee: "agent1" },
	{ dueInDays: -3, completed: true, assignee: "agent2" },
	{ dueInDays: 2, completed: false, assignee: "agent1" },
];

export async function seedActivities(
	bag: AgencyBag,
	rng: Rng,
	quotesByTag: Map<string, SeededQuote>,
	bookingsByTag: Map<string, SeededBooking>,
	shares: SeededShare[],
): Promise<void> {
	const rows: Prisma.ActivityCreateManyInput[] = [];
	const fallbackAuthor = (
		bag.users.find((user) => user.role === "admin") ?? bag.users[0]
	)?.id as string;
	const userId = (key: string): string =>
		bag.users.find((user) => user.key === key)?.id ?? fallbackAuthor;

	const timelineCustomers = bag.customers
		.filter((entry) => !entry.archived)
		.slice(0, 3);
	for (const customer of timelineCustomers) {
		const author = customer.ownerId ?? fallbackAuthor;
		for (let index = 0; index < integer(rng, 5, 9); index += 1) {
			const type = pick(rng, TIMELINE_TYPES);
			const { subject, body } = subjectFor(type, rng);
			rows.push({
				agencyId: bag.agencyId,
				type,
				subject,
				body,
				customerId: customer.id,
				createdById: author,
				occurredAt: daysFromNow(-integer(rng, 1, 90)),
			});
		}
	}

	for (const tag of ["agentOpenTask", "acceptedWithBooking"]) {
		const quote = quotesByTag.get(tag);
		if (!quote) continue;
		for (let index = 0; index < integer(rng, 4, 7); index += 1) {
			const type = pick(rng, TIMELINE_TYPES);
			const { subject, body } = subjectFor(type, rng);
			rows.push({
				agencyId: bag.agencyId,
				type,
				subject,
				body,
				quoteId: quote.id,
				createdById: quote.ownerId ?? fallbackAuthor,
				occurredAt: daysFromNow(-integer(rng, 1, 40)),
			});
		}
	}

	for (const tag of ["departs3", "completed"]) {
		const booking = bookingsByTag.get(tag);
		if (!booking) continue;
		for (let index = 0; index < integer(rng, 4, 7); index += 1) {
			const type = pick(rng, TIMELINE_TYPES);
			const { subject, body } = subjectFor(type, rng);
			rows.push({
				agencyId: bag.agencyId,
				type,
				subject,
				body,
				bookingId: booking.id,
				createdById: booking.ownerId ?? fallbackAuthor,
				occurredAt: daysFromNow(-integer(rng, 1, 50)),
			});
		}
	}

	const taskAnchors = bag.bookings.filter(
		(entry) => entry.status !== "CANCELLED",
	);
	for (let index = 0; index < TASK_SPECS.length; index += 1) {
		const spec = TASK_SPECS[index] as TaskSpec;
		const anchor = taskAnchors[index % taskAnchors.length] as SeededBooking;
		const assignee = spec.assignee ? userId(spec.assignee) : null;
		rows.push({
			agencyId: bag.agencyId,
			type: "TASK",
			subject: pick(rng, TASK_SUBJECTS),
			bookingId: anchor.id,
			customerId: anchor.customerId,
			createdById: anchor.ownerId ?? fallbackAuthor,
			assignedToId: assignee,
			dueAt: spec.dueInDays === null ? null : daysFromNow(spec.dueInDays),
			completedAt: spec.completed ? daysFromNow(-integer(rng, 1, 6)) : null,
			occurredAt: daysFromNow(-integer(rng, 1, 20)),
			reminderSentAt: spec.reminded ? daysFromNow(-2) : null,
		});
	}

	const openedShare = shares.find(
		(share) => share.quoteTag === "agentEligible",
	);
	if (openedShare) {
		rows.push({
			agencyId: bag.agencyId,
			type: "SYSTEM",
			subject: "Customer opened the quote link",
			quoteId: openedShare.quoteId,
			createdById: openedShare.createdById,
			occurredAt: openedShare.firstViewAt ?? daysFromNow(-5),
		});
	}

	const acceptedPublic = quotesByTag.get("acceptedPublic");
	if (acceptedPublic) {
		rows.push({
			agencyId: bag.agencyId,
			type: "SYSTEM",
			subject: "Cliente Final accepted the quote",
			quoteId: acceptedPublic.id,
			createdById: acceptedPublic.ownerId ?? fallbackAuthor,
			occurredAt: daysFromNow(-3),
		});
	}

	await db.activity.createMany({ data: rows });

	await seedReminderRows(bag, quotesByTag, bookingsByTag);
}

async function seedReminderRows(
	bag: AgencyBag,
	quotesByTag: Map<string, SeededQuote>,
	bookingsByTag: Map<string, SeededBooking>,
): Promise<void> {
	const now = new Date();
	const reminders: Prisma.ActivityCreateManyInput[] = [];

	const overduePayment = await db.payment.findFirst({
		where: {
			agencyId: bag.agencyId,
			status: "SCHEDULED",
			dueDate: { lt: now },
		},
		select: {
			id: true,
			bookingId: true,
			booking: { select: { folio: true, ownerId: true } },
		},
	});
	if (overduePayment?.booking.ownerId) {
		reminders.push({
			agencyId: bag.agencyId,
			type: "TASK",
			subject: `Overdue payment on ${overduePayment.booking.folio}`,
			bookingId: overduePayment.bookingId,
			createdById: overduePayment.booking.ownerId,
			assignedToId: overduePayment.booking.ownerId,
			dueAt: daysFromNow(-4),
			occurredAt: now,
			sourceKey: `payment-overdue:${overduePayment.id}`,
		});
	}

	const departs = bookingsByTag.get("departs3");
	if (departs?.ownerId) {
		reminders.push({
			agencyId: bag.agencyId,
			type: "TASK",
			subject: `Trip departs soon — ${departs.folio}`,
			bookingId: departs.id,
			createdById: departs.ownerId,
			assignedToId: departs.ownerId,
			dueAt: departs.travelStartDate ?? daysFromNow(3),
			occurredAt: now,
			sourceKey: `departure:${departs.id}`,
		});
	}

	const soonTraveler = bag.travelers[0];
	const departs9 = bookingsByTag.get("departs9");
	if (soonTraveler && departs9?.ownerId) {
		const expiryDay = isoDay(daysFromNow(20));
		reminders.push({
			agencyId: bag.agencyId,
			type: "TASK",
			subject: "Traveller document expires before the trip",
			bookingId: departs9.id,
			createdById: departs9.ownerId,
			assignedToId: departs9.ownerId,
			dueAt: daysFromNow(20),
			occurredAt: now,
			sourceKey: `document-expiry:${soonTraveler.id}:${expiryDay}`,
		});
	}

	const throttled = quotesByTag.get("agentThrottled");
	if (throttled?.ownerId) {
		reminders.push({
			agencyId: bag.agencyId,
			type: "TASK",
			subject: `Follow up on quote ${throttled.folio}`,
			quoteId: throttled.id,
			createdById: throttled.ownerId,
			assignedToId: throttled.ownerId,
			dueAt: daysFromNow(1),
			occurredAt: daysFromNow(-1),
			sourceKey: `quote-followup:${throttled.id}:${isoDay(daysFromNow(-1))}`,
		});
	}

	if (reminders.length > 0) {
		await db.activity.createMany({ data: reminders, skipDuplicates: true });
	}
}
