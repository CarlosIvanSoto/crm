"use client";

import TrashCan from "@carbon/icons-react/es/TrashCan";
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

function documents(count: number): string {
	return formatCount(count, "document");
}

export function DocumentsBulkActions({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const remove = useMutation(
		trpc.documents.removeMany.mutationOptions({
			onSuccess: async (result) => {
				await cache.document();
				reportBulk(result, (count) => `${documents(count)} removed.`);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<BulkActionsMenu pending={remove.isPending}>
			<DropdownMenuGroup>
				<DropdownMenuItem
					variant="destructive"
					onSelect={() => remove.mutate({ ids })}
				>
					<TrashCan />
					Remove
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</BulkActionsMenu>
	);
}
