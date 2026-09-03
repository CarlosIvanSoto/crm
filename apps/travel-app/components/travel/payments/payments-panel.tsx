"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { formatAmount } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LocalDay } from "@/components/local-date-time";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/types";
import {
	paymentMethodLabel,
	paymentStatusLabel,
	paymentStatusVariant,
} from "./payment-meta";

type PaymentKind = NonNullable<RouterInputs["payments"]["list"]["kind"]>;
type PaymentStatus = NonNullable<
	RouterInputs["payments"]["list"]["status"]
>[number];
type PaymentRow = RouterOutputs["payments"]["list"]["rows"][number];

type Props = {
	bookingId?: string;
	kind: PaymentKind;
	statuses: PaymentStatus[];
	canRecord: boolean;
};

export function PaymentsPanel({ bookingId, kind, statuses, canRecord }: Props) {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const payments = useQuery({
		...trpc.payments.list.queryOptions({ bookingId, kind, status: statuses }),
		placeholderData: (previous) => previous,
	});

	const onError = (error: { message: string }) => toast.error(error.message);
	const onSettled = async () => {
		await cache.payment(bookingId);
	};

	const recordCharge = useMutation(
		trpc.payments.record.mutationOptions({
			onSuccess: async () => {
				await onSettled();
				toast.success("Marked paid.");
			},
			onError,
		}),
	);
	const recordPayable = useMutation(
		trpc.payments.recordPayable.mutationOptions({
			onSuccess: async () => {
				await onSettled();
				toast.success("Marked paid.");
			},
			onError,
		}),
	);
	const voidCharge = useMutation(
		trpc.payments.void.mutationOptions({
			onSuccess: async () => {
				await onSettled();
				toast.success("Charge voided.");
			},
			onError,
		}),
	);
	const voidPayable = useMutation(
		trpc.payments.voidPayable.mutationOptions({
			onSuccess: async () => {
				await onSettled();
				toast.success("Payable voided.");
			},
			onError,
		}),
	);
	const removeCharge = useMutation(
		trpc.payments.remove.mutationOptions({
			onSuccess: async () => {
				await onSettled();
				toast.success("Charge removed.");
			},
			onError,
		}),
	);
	const removePayable = useMutation(
		trpc.payments.removePayable.mutationOptions({
			onSuccess: async () => {
				await onSettled();
				toast.success("Payable removed.");
			},
			onError,
		}),
	);

	const markPaid = (row: PaymentRow) => {
		const input = { id: row.id, paidAt: new Date().toISOString() };
		if (row.kind === "supplier") recordPayable.mutate(input);
		else recordCharge.mutate(input);
	};
	const voidRow = (row: PaymentRow) => {
		if (row.kind === "supplier") voidPayable.mutate({ id: row.id });
		else voidCharge.mutate({ id: row.id });
	};
	const removeRow = (row: PaymentRow) => {
		if (row.kind === "supplier") removePayable.mutate({ id: row.id });
		else removeCharge.mutate({ id: row.id });
	};

	const rows = payments.data?.rows ?? [];
	const totals = payments.data?.totals;

	return (
		<div className="space-y-3">
			{totals ? (
				<div className="flex flex-wrap gap-4 text-sm">
					<Total
						label="Scheduled"
						amount={totals.scheduledBase}
						currency={totals.baseCurrency}
					/>
					<Total
						label="Overdue"
						amount={totals.overdueBase}
						currency={totals.baseCurrency}
					/>
					<Total
						label="Paid"
						amount={totals.paidBase}
						currency={totals.baseCurrency}
					/>
					{totals.missingRate > 0 ? (
						<span className="text-muted-foreground">
							{totals.missingRate} without a rate
						</span>
					) : null}
				</div>
			) : null}

			<div className="divide-y rounded-lg border">
				{rows.length === 0 ? (
					<p className="p-3 text-muted-foreground text-sm">No payments.</p>
				) : null}
				{rows.map((row) => {
					const closed = row.storedStatus !== "SCHEDULED";
					return (
						<div key={row.id} className="flex items-center gap-3 p-3 text-sm">
							<Badge variant={paymentStatusVariant(row.status)}>
								{paymentStatusLabel(row.status)}
							</Badge>
							<span className="text-muted-foreground">
								{row.kind === "supplier" ? "Payable" : "Charge"}
							</span>
							<span className="tabular-nums">
								{formatAmount(row.amount, row.currency)}
							</span>
							<span className="text-muted-foreground">
								due <LocalDay date={row.dueDate} />
							</span>
							<span className="text-muted-foreground">
								{paymentMethodLabel(row.method)}
							</span>
							{canRecord ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="sm" className="ml-auto">
											Actions
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{!closed ? (
											<DropdownMenuItem onSelect={() => markPaid(row)}>
												Mark paid
											</DropdownMenuItem>
										) : null}
										{!closed ? (
											<DropdownMenuItem onSelect={() => voidRow(row)}>
												Void
											</DropdownMenuItem>
										) : null}
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => removeRow(row)}
										>
											Remove
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function Total({
	label,
	amount,
	currency,
}: {
	label: string;
	amount: number;
	currency: string | null;
}) {
	return (
		<span>
			<span className="text-muted-foreground">{label} </span>
			<span className="tabular-nums">
				{formatAmount(amount, currency ?? "usd")}
			</span>
		</span>
	);
}
