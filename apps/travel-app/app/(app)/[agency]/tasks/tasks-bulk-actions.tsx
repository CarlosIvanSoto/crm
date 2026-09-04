"use client";

import Checkmark from "@carbon/icons-react/es/Checkmark";
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

export function TasksBulkActions({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const complete = useMutation(
		trpc.activities.completeMany.mutationOptions({
			onSuccess: async (result) => {
				await cache.activity();
				reportBulk(
					result,
					(count) => `${formatCount(count, "task")} completed.`,
				);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<BulkActionsMenu pending={complete.isPending}>
			<DropdownMenuGroup>
				<DropdownMenuItem onSelect={() => complete.mutate({ ids })}>
					<Checkmark />
					Mark done
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</BulkActionsMenu>
	);
}
