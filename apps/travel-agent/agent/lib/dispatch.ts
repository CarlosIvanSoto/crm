import { DISPATCH } from "./dispatch-config";
import {
	claimDue,
	completeTask,
	type LeasedTask,
	retireExhausted,
} from "./tasks";

export type AppAuth = {
	attributes: Readonly<Record<string, string | readonly string[]>>;
	authenticator: string;
	principalId: string;
	principalType: string;
};

export const APP_AUTH: AppAuth = {
	attributes: {},
	authenticator: "app",
	principalId: "eve:app",
	principalType: "runtime",
};

export const DRAIN_TIMEOUT_MS = DISPATCH.sweep.timeoutMs;

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;

	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new TimeoutError(`Timed out after ${ms}ms`)),
			ms,
		);
	});

	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function reasonOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

let lastSweepStartedAt: Date | null = null;
let lastSweepFinishedAt: Date | null = null;
let lastSweepError: string | null = null;

export function dispatchHealth() {
	return {
		startedAt: lastSweepStartedAt?.toISOString() ?? null,
		finishedAt: lastSweepFinishedAt?.toISOString() ?? null,
		lastError: lastSweepError,
	};
}

export async function drainAll(
	start: (task: LeasedTask) => Promise<{ id: string }>,
): Promise<number> {
	lastSweepStartedAt = new Date();
	lastSweepError = null;
	let handled = 0;

	try {
		await retireExhausted();
		const tasks = await claimDue();

		await Promise.all(
			tasks.map(async (task) => {
				try {
					await withTimeout(start(task), DISPATCH.sweep.itemTimeoutMs);
					handled += 1;
				} catch (error) {
					if (error instanceof TimeoutError) return;
					await completeTask(task.id, `Failed: ${reasonOf(error)}`).catch(
						() => {},
					);
				}
			}),
		);
	} catch (error) {
		lastSweepError = reasonOf(error);
		throw error;
	} finally {
		lastSweepFinishedAt = new Date();
	}

	return handled;
}

export function brief(task: LeasedTask): string {
	const again =
		task.attempts > 1
			? "This is a retry; the earlier attempt did not finish. Carry on from what is already in this thread rather than starting again. "
			: "";

	return `${again}${work(task.kind, task.reason)}`;
}

function work(kind: string, reason: string): string {
	if (kind === "quote-followup") {
		return `A quote was sent to a customer and has stayed undecided for several days. Read the quote, its share status and the customer, then file one follow-up task for the quote's advisor with a drafted follow-up message. Reason: ${reason}`;
	}

	return `Handle this: ${reason}`;
}

export function taskAuth(task: LeasedTask, base: AppAuth = APP_AUTH): AppAuth {
	return {
		...base,
		attributes: {
			...base.attributes,
			taskKind: task.kind,
			reason: task.reason,
			agencyId: task.agencyId,
			quoteId: task.quoteId ?? "",
		},
	};
}
