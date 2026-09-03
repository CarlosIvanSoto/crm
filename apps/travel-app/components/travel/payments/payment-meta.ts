export const PAYMENT_METHODS = [
	{ value: "CASH", label: "Cash" },
	{ value: "TRANSFER", label: "Transfer" },
	{ value: "CARD", label: "Card" },
	{ value: "LINK", label: "Payment link" },
	{ value: "OTHER", label: "Other" },
] as const;

export const PAYMENT_STATUSES = [
	{ value: "SCHEDULED", label: "Scheduled" },
	{ value: "OVERDUE", label: "Overdue" },
	{ value: "PAID", label: "Paid" },
	{ value: "VOID", label: "Void" },
] as const;

export function paymentMethodLabel(method: string | null): string {
	if (!method) return "—";
	return (
		PAYMENT_METHODS.find((entry) => entry.value === method)?.label ?? method
	);
}

export function paymentStatusLabel(status: string): string {
	return (
		PAYMENT_STATUSES.find((entry) => entry.value === status)?.label ?? status
	);
}

export function paymentStatusVariant(
	status: string,
): "outline" | "secondary" | "destructive" | "default" {
	if (status === "PAID") return "default";
	if (status === "OVERDUE") return "destructive";
	if (status === "VOID") return "outline";
	return "secondary";
}
