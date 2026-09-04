export const COMMISSION_STATUSES = [
	{ value: "PENDING", label: "Pending" },
	{ value: "APPROVED", label: "Approved" },
	{ value: "PAID", label: "Paid" },
	{ value: "VOID", label: "Void" },
] as const;

export const COMMISSION_BASES = [
	{ value: "MARGIN", label: "Margin" },
	{ value: "SELL", label: "Sell" },
	{ value: "FIXED", label: "Fixed" },
] as const;

export function commissionStatusLabel(status: string): string {
	return (
		COMMISSION_STATUSES.find((entry) => entry.value === status)?.label ?? status
	);
}

export function commissionBasisLabel(basis: string): string {
	return (
		COMMISSION_BASES.find((entry) => entry.value === basis)?.label ?? basis
	);
}

export function commissionStatusVariant(
	status: string,
): "outline" | "secondary" | "destructive" | "default" {
	if (status === "PAID") return "default";
	if (status === "VOID") return "destructive";
	if (status === "APPROVED") return "secondary";
	return "outline";
}
