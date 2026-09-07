import { randomUUID } from "node:crypto";
import { db } from "../../src/client";
import type { AgencyBag, SeededQuote } from "./context";
import { daysFromNow, type Rng } from "./random";

interface TaskSpec {
	quoteTag: string;
	sentDaysAgo: number;
	state: "open" | "finished" | "retired" | "claimable" | "future";
}

const TASK_SPECS: TaskSpec[] = [
	{ quoteTag: "agentOpenTask", sentDaysAgo: 9, state: "open" },
	{ quoteTag: "declined", sentDaysAgo: 18, state: "finished" },
	{ quoteTag: "expired", sentDaysAgo: 30, state: "retired" },
	{ quoteTag: "nonBase", sentDaysAgo: 8, state: "claimable" },
	{ quoteTag: "unpricedOption", sentDaysAgo: 4, state: "future" },
];

export async function seedAgentTasks(
	bag: AgencyBag,
	_rng: Rng,
	quotesByTag: Map<string, SeededQuote>,
): Promise<void> {
	for (const spec of TASK_SPECS) {
		const quote = quotesByTag.get(spec.quoteTag);
		if (!quote) continue;

		const reason = `Quote ${quote.folio} was sent ${spec.sentDaysAgo} days ago and is still undecided.`;
		const base = {
			agencyId: bag.agencyId,
			quoteId: quote.id,
			kind: "quote-followup",
			reason,
			subject: quote.id,
			priority: 0,
			budget: 4,
			createdAt: daysFromNow(-spec.sentDaysAgo + 3),
		};

		if (spec.state === "open") {
			await db.agentTask.create({
				data: { ...base, dueAt: daysFromNow(-1), attempts: 1 },
			});
		} else if (spec.state === "finished") {
			await db.agentTask.create({
				data: {
					...base,
					dueAt: daysFromNow(-2),
					attempts: 1,
					sessionId: `seed-session-${randomUUID().slice(0, 8)}`,
					startedAt: daysFromNow(-2),
					finishedAt: daysFromNow(-2),
					outcome: "Filed a follow-up task for the advisor.",
				},
			});
		} else if (spec.state === "retired") {
			await db.agentTask.create({
				data: {
					...base,
					dueAt: daysFromNow(-3),
					attempts: 5,
					finishedAt: daysFromNow(-1),
					outcome: "Retired: too many failed attempts.",
				},
			});
		} else if (spec.state === "claimable") {
			await db.agentTask.create({
				data: { ...base, dueAt: daysFromNow(-1), attempts: 0 },
			});
		} else {
			await db.agentTask.create({
				data: { ...base, dueAt: daysFromNow(1), attempts: 0 },
			});
		}
	}
}
