export function dateInputToIso(value: string): string | null {
	if (!value) return null;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function isoToDateInput(value: string | null): string {
	if (!value) return "";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime())
		? ""
		: parsed.toISOString().slice(0, 10);
}
