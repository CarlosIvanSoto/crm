"use client";

import { Button } from "@crm/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";
import {
	PAYMENT_STATUSES,
	paymentStatusLabel,
} from "@/components/travel/payments/payment-meta";
import { PaymentsPanel } from "@/components/travel/payments/payments-panel";
import { canRecordPayment } from "@/lib/roles";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";

type PaymentKind = NonNullable<RouterInputs["payments"]["list"]["kind"]>;
type PaymentStatus = NonNullable<
	RouterInputs["payments"]["list"]["status"]
>[number];

const KINDS: { value: PaymentKind; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "customer", label: "Charges" },
	{ value: "supplier", label: "Payables" },
];

const STATUS_VALUES = PAYMENT_STATUSES.map((entry) => entry.value);

export function PaymentsScreen() {
	const trpc = useTRPC();
	const me = useQuery(trpc.users.me.queryOptions());
	const canRecord = canRecordPayment(me.data?.role ?? null);

	const [kind, setKind] = useQueryState(
		"kind",
		parseAsStringLiteral(["all", "customer", "supplier"] as const).withDefault(
			"all",
		),
	);
	const [statuses, setStatuses] = useQueryState(
		"status",
		parseAsArrayOf(parseAsStringLiteral(STATUS_VALUES)).withDefault([]),
	);

	const toggleStatus = (value: PaymentStatus) => {
		void setStatuses((current) =>
			current.includes(value)
				? current.filter((entry) => entry !== value)
				: [...current, value],
		);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
			<div className="flex flex-wrap items-center gap-2">
				{KINDS.map((option) => (
					<Button
						key={option.value}
						size="sm"
						variant={kind === option.value ? "contrast" : "outline"}
						onClick={() => setKind(option.value)}
					>
						{option.label}
					</Button>
				))}
				<span className="mx-1 h-4 w-px bg-border" />
				{PAYMENT_STATUSES.map((option) => (
					<Button
						key={option.value}
						size="sm"
						variant={statuses.includes(option.value) ? "contrast" : "outline"}
						onClick={() => toggleStatus(option.value)}
					>
						{paymentStatusLabel(option.value)}
					</Button>
				))}
			</div>

			<PaymentsPanel kind={kind} statuses={statuses} canRecord={canRecord} />
		</div>
	);
}
