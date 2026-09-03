export const SUPPLIER_KINDS = [
	{ value: "WHOLESALER", label: "Wholesaler" },
	{ value: "DMC", label: "DMC" },
	{ value: "HOTEL", label: "Hotel" },
	{ value: "AIRLINE", label: "Airline" },
	{ value: "CRUISE", label: "Cruise line" },
	{ value: "INSURANCE", label: "Insurer" },
	{ value: "TRANSFER", label: "Transfer" },
	{ value: "TOUR_OPERATOR", label: "Tour operator" },
	{ value: "CAR_RENTAL", label: "Car rental" },
	{ value: "OTHER", label: "Other" },
] as const;

export function supplierKindLabel(kind: string): string {
	return SUPPLIER_KINDS.find((entry) => entry.value === kind)?.label ?? "Other";
}
