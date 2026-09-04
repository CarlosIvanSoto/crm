"use client";

import Checkmark from "@carbon/icons-react/es/Checkmark";
import Money from "@carbon/icons-react/es/Money";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@crm/ui/components/dropdown-menu";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BulkActionsMenu, reportBulk } from "@/components/travel/bulk-actions";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function commissions(count: number): string {
	return formatCount(count, "commission");
}

export function CommissionsBulkActions({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const onError = (error: { message: string }) => toast.error(error.message);

	const approve = useMutation(
		trpc.commissions.bulkApprove.mutationOptions({
			onSuccess: async (result) => {
				await cache.commission();
				reportBulk(result, (count) => `${commissions(count)} approved.`);
				onDone();
			},
			onError,
		}),
	);

	const markPaid = useMutation(
		trpc.commissions.bulkMarkPaid.mutationOptions({
			onSuccess: async (result) => {
				await cache.commission();
				reportBulk(result, (count) => `${commissions(count)} marked paid.`);
				onDone();
			},
			onError,
		}),
	);

	const pending = approve.isPending || markPaid.isPending;

	return (
		<BulkActionsMenu pending={pending}>
			<DropdownMenuGroup>
				<DropdownMenuItem onSelect={() => approve.mutate({ ids })}>
					<Checkmark />
					Approve
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => markPaid.mutate({ ids })}>
					<Money />
					Mark paid
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</BulkActionsMenu>
	);
}
