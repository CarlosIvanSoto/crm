"use client";

import Archive from "@carbon/icons-react/es/Archive";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Undo from "@carbon/icons-react/es/Undo";
import UserAvatar from "@carbon/icons-react/es/UserAvatar";
import { Avatar, AvatarFallback } from "@crm/ui/components/avatar";
import { Button } from "@crm/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { initialsFromName } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetHeader,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useRecordStack } from "./record-stack";

export function CustomerSheet({ customerId }: { customerId: string }) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const { stack, close } = useRecordStack();

	const customer = useQuery(
		trpc.customers.byId.queryOptions({ id: customerId }),
	);

	const onError = (error: { message: string }) => toast.error(error.message);

	const archive = useMutation(
		trpc.customers.archive.mutationOptions({
			onSuccess: async () => {
				await cache.customer(customerId);
				toast.success("Customer archived.");
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.customers.restore.mutationOptions({
			onSuccess: async () => {
				await cache.customer(customerId);
				toast.success("Customer restored.");
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.customers.purge.mutationOptions({
			onSuccess: async () => {
				await cache.removed({ kind: "customer", id: customerId });
				toast.success("Customer deleted forever.");
				close();
			},
			onError,
		}),
	);

	const onBack = stack.length > 1 ? () => close() : undefined;

	if (customer.isError) {
		return (
			<>
				<DetailSheetHeader
					title="Customer"
					onBack={onBack}
					onClose={() => close()}
				/>
				<DetailSheetBody>
					<DetailSheetEmpty
						icon={UserAvatar}
						title="Not found"
						description="This customer does not exist, or belongs to another agency."
					/>
				</DetailSheetBody>
			</>
		);
	}

	const data = customer.data;
	const archived = Boolean(data?.archivedAt);

	return (
		<>
			<DetailSheetHeader
				media={
					<Avatar className="size-9">
						<AvatarFallback>
							{initialsFromName(data?.name ?? "?")}
						</AvatarFallback>
					</Avatar>
				}
				title={data?.name ?? "Loading…"}
				description={data ? typeLabel(data.type) : undefined}
				onBack={onBack}
				onClose={() => close()}
				actions={
					data ? (
						<>
							{archived ? (
								<>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												disabled={restore.isPending}
												onClick={() => restore.mutate({ id: customerId })}
											>
												<Undo />
												<span className="sr-only">Restore</span>
											</Button>
										</TooltipTrigger>
										<TooltipContent>Restore</TooltipContent>
									</Tooltip>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												disabled={purge.isPending}
												onClick={() => purge.mutate({ id: customerId })}
											>
												<TrashCan />
												<span className="sr-only">Delete forever</span>
											</Button>
										</TooltipTrigger>
										<TooltipContent>Delete forever</TooltipContent>
									</Tooltip>
								</>
							) : (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											disabled={archive.isPending}
											onClick={() => archive.mutate({ id: customerId })}
										>
											<Archive />
											<span className="sr-only">Archive</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Archive</TooltipContent>
								</Tooltip>
							)}
						</>
					) : undefined
				}
			/>

			<DetailSheetBody>
				<DetailSheetSection title="Details">
					<DetailSheetProperties>
						<DetailSheetProperty label="Type">
							{data ? typeLabel(data.type) : "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Email">
							{data?.email ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Phone">
							{data?.phone ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="WhatsApp">
							{data?.whatsapp ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Legal name">
							{data?.legalName ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Tax ID">
							{data?.taxId ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Owner">
							{data?.owner?.name ?? "Unassigned"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Created">
							{data ? <LocalRelativeTime date={data.createdAt} /> : "—"}
						</DetailSheetProperty>
					</DetailSheetProperties>
				</DetailSheetSection>

				<DetailSheetSection title="Activity">
					<div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
						<span>{data?.quoteCount ?? 0} quotes</span>
						<span>{data?.bookingCount ?? 0} bookings</span>
					</div>
				</DetailSheetSection>
			</DetailSheetBody>
		</>
	);
}

function typeLabel(type: string): string {
	return type === "COMPANY" ? "Company" : "Person";
}
