export const CURRENCY = {
	fillMissing: {
		maxRowsPerRun: 1000,
	},
	rates: {
		provider: "open.er-api.com",
		url: "https://open.er-api.com/v6/latest",
		timeoutMs: 6_000,
		attempts: 2,
		retryDelayMs: 400,
	},
} as const;
