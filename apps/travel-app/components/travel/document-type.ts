export const DOCUMENT_TYPES = [
	{ value: "PASSPORT", label: "Passport" },
	{ value: "ID", label: "ID card" },
	{ value: "VISA", label: "Visa" },
] as const;

export function documentTypeLabel(type: string | null): string {
	if (!type) return "—";
	return DOCUMENT_TYPES.find((entry) => entry.value === type)?.label ?? type;
}
