import type { Prisma } from "@travel/db";
import { db } from "./db";
import { DISPATCH } from "./dispatch-config";

export type LeasedTask = {
	id: string;
	agencyId: string;
	quoteId: string | null;
	kind: string;
	reason: string;
	payload: Prisma.JsonValue | null;
	budget: number;
	attempts: number;
	priority: number;
	dueAt: Date;
};

export const MAX_ATTEMPTS = 5;

const LEASE_MS = DISPATCH.task.leaseMs;

export async function claimDue(
	limit: number = DISPATCH.task.batch,
	leaseMs = LEASE_MS,
): Promise<LeasedTask[]> {
	const now = new Date();
	const until = new Date(now.getTime() + leaseMs);

	const claimed = await db.$queryRaw<LeasedTask[]>`
		UPDATE "agentTask" AS t
		SET "leasedUntil" = ${until},
			"startedAt" = COALESCE(t."startedAt", ${now}),
			"attempts" = t."attempts" + 1
		FROM (
			SELECT t2.id FROM "agentTask" AS t2
			WHERE t2."finishedAt" IS NULL
				AND t2."dueAt" <= ${now}
				AND (t2."leasedUntil" IS NULL OR t2."leasedUntil" < ${now})
				AND t2."attempts" < ${MAX_ATTEMPTS}
			ORDER BY t2."priority" DESC, t2."dueAt" ASC
			LIMIT ${limit}
			FOR UPDATE SKIP LOCKED
		) AS due
		WHERE t.id = due.id
		RETURNING t.id, t."agencyId", t."quoteId", t.kind, t.reason, t.payload,
			t.budget, t.attempts, t.priority, t."dueAt";
	`;

	return claimed.sort(
		(a, b) => b.priority - a.priority || a.dueAt.getTime() - b.dueAt.getTime(),
	);
}

export async function retireExhausted(
	limit: number = DISPATCH.reconcile.retire,
): Promise<{ id: string }[]> {
	const now = new Date();

	return db.$queryRaw<{ id: string }[]>`
		UPDATE "agentTask" AS t
		SET "finishedAt" = ${now},
			"outcome" = 'Retired: too many failed attempts.'
		WHERE t.id IN (
			SELECT c.id
			FROM "agentTask" AS c
			WHERE c."finishedAt" IS NULL
				AND c."attempts" >= ${MAX_ATTEMPTS}
				AND (c."leasedUntil" IS NULL OR c."leasedUntil" < ${now})
			ORDER BY c."dueAt" ASC
			LIMIT ${limit}
			FOR UPDATE SKIP LOCKED
		)
		RETURNING t.id;
	`;
}

export type TaskSubject = {
	id: string;
	agencyId: string;
	quoteId: string | null;
	kind: string;
};

export async function completeTask(
	taskId: string,
	outcome: string,
	sessionId?: string,
): Promise<TaskSubject | null> {
	const { count } = await db.agentTask.updateMany({
		where: { id: taskId, finishedAt: null },
		data: {
			finishedAt: new Date(),
			outcome: outcome.slice(0, 500),
			sessionId: sessionId || undefined,
		},
	});

	if (count === 0) return null;

	return db.agentTask.findUnique({
		where: { id: taskId },
		select: { id: true, agencyId: true, quoteId: true, kind: true },
	});
}

export async function taskSubject(taskId: string): Promise<TaskSubject | null> {
	return db.agentTask.findUnique({
		where: { id: taskId },
		select: { id: true, agencyId: true, quoteId: true, kind: true },
	});
}

export type { Prisma };
