"use client";

import Add from "@carbon/icons-react/es/Add";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { formatAmount, formatPercent } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { AddCommissionDialog } from "./commission-dialogs";
import {
	commissionBasisLabel,
	commissionStatusLabel,
	commissionStatusVariant,
} from "./commission-meta";

type CommissionRow = RouterOutputs["commissions"]["byBooking"]["rows"][number];

type Props = {
	bookingId: string;
	canManage: boolean;
};

export function CommissionsPanel({ bookingId, canManage }: Props) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const [adding, setAdding] = useState(false);

	const commissions = useQuery({
		...trpc.commissions.byBooking.queryOptions({ bookingId }),
		placeholderData: (previous) => previous,
	});

	const onError = (error: { message: string }) => toast.error(error.message);
	const onSettled = async (message: string) => {
		await cache.commission(bookingId);
		toast.success(message);
	};

	const approve = useMutation(
		trpc.commissions.approve.mutationOptions({
			onSuccess: () => onSettled("Commission approved."),
			onError,
		}),
	);
	const markPaid = useMutation(
		trpc.commissions.markPaid.mutationOptions({
			onSuccess: () => onSettled("Commission marked paid."),
			onError,
		}),
	);
	const recalculate = useMutation(
		trpc.commissions.recalculate.mutationOptions({
			onSuccess: () => onSettled("Commission recalculated."),
			onError,
		}),
	);
	const voidCommission = useMutation(
		trpc.commissions.void.mutationOptions({
			onSuccess: () => onSettled("Commission voided."),
			onError,
		}),
	);
	const remove = useMutation(
		trpc.commissions.remove.mutationOptions({
			onSuccess: () => onSettled("Commission removed."),
			onError,
		}),
	);

	const rows = commissions.data?.rows ?? [];
	const marginBase = commissions.data?.bookingMarginBase ?? null;
	const baseCurrency = commissions.data?.baseCurrency ?? "usd";
	const owed = rows
		.filter((row) => row.status !== "VOID" && row.amountBase !== null)
		.reduce((sum, row) => sum + (row.amountBase ?? 0), 0);
	const missingRate = rows.filter(
		(row) => row.status !== "VOID" && row.amountBase === null,
	).length;

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-4 text-sm">
				{marginBase !== null ? (
					<span>
						<span className="text-muted-foreground">Booking margin </span>
						<span className="tabular-nums">
							{formatAmount(marginBase, baseCurrency)}
						</span>
					</span>
				) : null}
				<span>
					<span className="text-muted-foreground">Owed to advisors </span>
					<span className="tabular-nums">
						{formatAmount(owed, baseCurrency)}
					</span>
				</span>
				{missingRate > 0 ? (
					<span className="text-muted-foreground">
						{missingRate} without a rate
					</span>
				) : null}
				{canManage ? (
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						onClick={() => setAdding(true)}
					>
						<Add data-icon="inline-start" />
						Add
					</Button>
				) : null}
			</div>

			<div className="divide-y rounded-lg border">
				{rows.length === 0 ? (
					<p className="p-3 text-muted-foreground text-sm">No commissions.</p>
				) : null}
				{rows.map((row) => (
					<CommissionLine
						key={row.id}
						row={row}
						canManage={canManage}
						onApprove={() => approve.mutate({ id: row.id })}
						onMarkPaid={() => markPaid.mutate({ id: row.id })}
						onRecalculate={() => recalculate.mutate({ id: row.id })}
						onVoid={() => voidCommission.mutate({ id: row.id })}
						onRemove={() => remove.mutate({ id: row.id })}
					/>
				))}
			</div>

			<AddCommissionDialog
				bookingId={bookingId}
				open={adding}
				onOpenChange={setAdding}
			/>
		</div>
	);
}

function CommissionLine({
	row,
	canManage,
	onApprove,
	onMarkPaid,
	onRecalculate,
	onVoid,
	onRemove,
}: {
	row: CommissionRow;
	canManage: boolean;
	onApprove: () => void;
	onMarkPaid: () => void;
	onRecalculate: () => void;
	onVoid: () => void;
	onRemove: () => void;
}) {
	const closed = row.status === "PAID" || row.status === "VOID";

	return (
		<div className="flex items-center gap-3 p-3 text-sm">
			<Badge variant={commissionStatusVariant(row.status)}>
				{commissionStatusLabel(row.status)}
			</Badge>
			<span className="text-muted-foreground">{row.userName}</span>
			<span className="text-muted-foreground">
				{commissionBasisLabel(row.basis)}
				{row.rate === null ? "" : ` · ${formatPercent(row.rate)}`}
			</span>
			<span className="tabular-nums">
				{row.amountBase === null ? (
					<span className="text-muted-foreground">No rate</span>
				) : (
					formatAmount(row.amountBase, row.baseCurrency ?? "usd")
				)}
			</span>
			{canManage ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="ml-auto">
							Actions
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{row.status === "PENDING" ? (
							<DropdownMenuItem onSelect={onApprove}>Approve</DropdownMenuItem>
						) : null}
						{row.status === "APPROVED" ? (
							<DropdownMenuItem onSelect={onMarkPaid}>
								Mark paid
							</DropdownMenuItem>
						) : null}
						{!closed ? (
							<DropdownMenuItem onSelect={onRecalculate}>
								Recalculate
							</DropdownMenuItem>
						) : null}
						{row.status !== "VOID" ? (
							<DropdownMenuItem onSelect={onVoid}>Void</DropdownMenuItem>
						) : null}
						{row.status !== "PAID" ? (
							<DropdownMenuItem variant="destructive" onSelect={onRemove}>
								Remove
							</DropdownMenuItem>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}
