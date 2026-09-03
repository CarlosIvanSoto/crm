"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Store from "@carbon/icons-react/es/Store";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Undo from "@carbon/icons-react/es/Undo";
import { Button } from "@crm/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetHeader,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetProse,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalRelativeTime } from "@/components/local-date-time";
import { supplierKindLabel } from "@/components/travel/supplier-kind";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useRecordStack } from "./record-stack";

export function SupplierSheet({ supplierId }: { supplierId: string }) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const { stack, close } = useRecordStack();

	const supplier = useQuery(
		trpc.suppliers.byId.queryOptions({ id: supplierId }),
	);

	const onError = (error: { message: string }) => toast.error(error.message);

	const archive = useMutation(
		trpc.suppliers.archive.mutationOptions({
			onSuccess: async () => {
				await cache.supplier(supplierId);
				toast.success("Supplier archived.");
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.suppliers.restore.mutationOptions({
			onSuccess: async () => {
				await cache.supplier(supplierId);
				toast.success("Supplier restored.");
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.suppliers.purge.mutationOptions({
			onSuccess: async () => {
				await cache.removed({ kind: "supplier", id: supplierId });
				toast.success("Supplier deleted forever.");
				close();
			},
			onError,
		}),
	);

	const onBack = stack.length > 1 ? () => close() : undefined;

	if (supplier.isError) {
		return (
			<>
				<DetailSheetHeader
					title="Supplier"
					onBack={onBack}
					onClose={() => close()}
				/>
				<DetailSheetBody>
					<DetailSheetEmpty
						icon={Store}
						title="Not found"
						description="This supplier does not exist, or belongs to another agency."
					/>
				</DetailSheetBody>
			</>
		);
	}

	const data = supplier.data;
	const archived = Boolean(data?.archivedAt);
	const commission =
		data?.defaultCommissionRate == null
			? "—"
			: `${(data.defaultCommissionRate * 100).toFixed(1)}%`;

	return (
		<>
			<DetailSheetHeader
				title={data?.name ?? "Loading…"}
				description={data ? supplierKindLabel(data.kind) : undefined}
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
												onClick={() => restore.mutate({ id: supplierId })}
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
												onClick={() => purge.mutate({ id: supplierId })}
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
											onClick={() => archive.mutate({ id: supplierId })}
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
						<DetailSheetProperty label="Kind">
							{data ? supplierKindLabel(data.kind) : "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Email">
							{data?.email ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Phone">
							{data?.phone ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Currency">
							{data?.defaultCurrency ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Commission">
							{commission}
						</DetailSheetProperty>
						<DetailSheetProperty label="Terms">
							{data?.paymentTermsDays == null
								? "—"
								: `${data.paymentTermsDays} days`}
						</DetailSheetProperty>
						<DetailSheetProperty label="Created">
							{data ? <LocalRelativeTime date={data.createdAt} /> : "—"}
						</DetailSheetProperty>
					</DetailSheetProperties>
				</DetailSheetSection>

				{data?.notes ? (
					<DetailSheetSection title="Notes">
						<DetailSheetProse>{data.notes}</DetailSheetProse>
					</DetailSheetSection>
				) : null}

				<DetailSheetSection title="Usage">
					<div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
						<span>{data?.quoteItemCount ?? 0} quote lines</span>
						<span>{data?.bookingItemCount ?? 0} booked lines</span>
					</div>
				</DetailSheetSection>
			</DetailSheetBody>
		</>
	);
}
