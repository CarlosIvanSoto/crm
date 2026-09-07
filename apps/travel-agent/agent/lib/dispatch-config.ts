const MINUTE_MS = 60_000;

export const DISPATCH = {
	task: {
		batch: 20,
		leaseMs: 10 * MINUTE_MS,
	},

	sweep: {
		timeoutMs: 4 * MINUTE_MS,
		itemTimeoutMs: 2 * MINUTE_MS,
	},

	reconcile: {
		retire: 100,
	},
} as const;
