export type DocumentAnchor = { bookingId: string } | { travelerId: string };

export const DOCUMENT_KINDS = [
	{ value: "VOUCHER", label: "Voucher" },
	{ value: "TICKET", label: "Ticket" },
	{ value: "INVOICE", label: "Invoice" },
	{ value: "PASSPORT", label: "Passport" },
	{ value: "VISA", label: "Visa" },
	{ value: "INSURANCE_POLICY", label: "Insurance policy" },
	{ value: "OTHER", label: "Other" },
] as const;

export function documentKindLabel(kind: string): string {
	return DOCUMENT_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

export function formatBytes(bytes: number | null): string {
	if (bytes === null) return "—";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
