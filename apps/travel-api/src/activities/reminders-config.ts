const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const REMINDERS = {
	sweep: { maxAgenciesPerRun: 200, maxRowsPerAgency: 200 },
	departure: { windowDays: 7 },
	travelDocument: { windowDays: 30 },
	task: { resendAfterMs: 7 * DAY_MS },
} as const;
