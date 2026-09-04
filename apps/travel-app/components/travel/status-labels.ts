export const QUOTE_STATUSES = [
	{ value: "DRAFT", label: "Draft" },
	{ value: "SENT", label: "Sent" },
	{ value: "ACCEPTED", label: "Accepted" },
	{ value: "DECLINED", label: "Declined" },
	{ value: "EXPIRED", label: "Expired" },
] as const;

export const BOOKING_STATUSES = [
	{ value: "DRAFT", label: "Draft" },
	{ value: "CONFIRMED", label: "Confirmed" },
	{ value: "TRAVELING", label: "Traveling" },
	{ value: "COMPLETED", label: "Completed" },
	{ value: "CANCELLED", label: "Cancelled" },
] as const;

export const PAX_TYPES = [
	{ value: "ADULT", label: "Adult" },
	{ value: "CHILD", label: "Child" },
	{ value: "INFANT", label: "Infant" },
] as const;

export const TASK_WINDOWS = [
	{ value: "overdue", label: "Overdue" },
	{ value: "today", label: "Today" },
	{ value: "week", label: "This week" },
	{ value: "all", label: "All" },
] as const;

export function quoteStatusLabel(status: string): string {
	return (
		QUOTE_STATUSES.find((entry) => entry.value === status)?.label ?? status
	);
}

export function bookingStatusLabel(status: string): string {
	return (
		BOOKING_STATUSES.find((entry) => entry.value === status)?.label ?? status
	);
}

export function paxTypeLabel(type: string): string {
	return PAX_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export function taskWindowLabel(window: string): string {
	return TASK_WINDOWS.find((entry) => entry.value === window)?.label ?? window;
}
