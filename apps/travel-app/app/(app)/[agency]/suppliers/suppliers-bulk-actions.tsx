"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Undo from "@carbon/icons-react/es/Undo";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@crm/ui/components/dropdown-menu";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	reportBulk,
} from "@/components/travel/bulk-actions";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function suppliers(count: number): string {
	return formatCount(count, "supplier");
}

export function SuppliersBulkActions({
	ids,
	onDone,
	archived,
}: {
	ids: string[];
	onDone: () => void;
	archived: boolean;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const [confirming, setConfirming] = useState(false);

	const onError = (error: { message: string }) => toast.error(error.message);

	const archive = useMutation(
		trpc.suppliers.bulkArchive.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "supplier", ids: variables.ids });
				reportBulk(result, (count) => `${suppliers(count)} archived.`);
				onDone();
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.suppliers.bulkRestore.mutationOptions({
			onSuccess: async (result) => {
				await cache.supplier();
				reportBulk(result, (count) => `${suppliers(count)} restored.`);
				onDone();
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.suppliers.bulkPurge.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "supplier", ids: variables.ids });
				reportBulk(result, (count) => `${suppliers(count)} deleted forever.`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	if (archived) {
		const pending = restore.isPending || purge.isPending;
		return (
			<>
				<BulkActionsMenu pending={pending}>
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={() => restore.mutate({ ids })}>
							<Undo />
							Restore
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => setConfirming(true)}
						>
							Delete forever
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</BulkActionsMenu>

				<BulkDeleteDialog
					open={confirming}
					onOpenChange={setConfirming}
					title={`Delete ${suppliers(ids.length)} forever?`}
					description="This cannot be undone."
					onConfirm={() => purge.mutate({ ids })}
				/>
			</>
		);
	}

	return (
		<BulkActionsMenu pending={archive.isPending}>
			<DropdownMenuGroup>
				<DropdownMenuItem onSelect={() => archive.mutate({ ids })}>
					<Archive />
					Archive
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</BulkActionsMenu>
	);
}
