const DAY_MS = 24 * 60 * 60 * 1000;

export const QUOTE_FOLLOWUP = {
	firstCheckAfterDays: 3,
	reminderIntervalDays: 5,
	sweep: { maxAgenciesPerRun: 200 },
} as const;

export const QUOTE_FOLLOWUP_DAY_MS = DAY_MS;
