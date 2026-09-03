"use client";

import Add from "@carbon/icons-react/es/Add";
import Archive from "@carbon/icons-react/es/Archive";
import Plane from "@carbon/icons-react/es/Plane";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Undo from "@carbon/icons-react/es/Undo";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { SaveBar } from "@crm/ui/components/save-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetHeader,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { documentTypeLabel } from "@/components/travel/document-type";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useRecordStack } from "./record-stack";

const NO_SUPPLIER = "none";

type LoyaltyDraft = {
	key: string;
	supplierId: string;
	programName: string;
	number: string;
};

type SavedLoyalty = {
	supplierId: string | null;
	programName: string;
	number: string;
};

function toDraft(entries: SavedLoyalty[]): LoyaltyDraft[] {
	return entries.map((entry, index) => ({
		key: `saved-${index}`,
		supplierId: entry.supplierId ?? NO_SUPPLIER,
		programName: entry.programName,
		number: entry.number,
	}));
}

export function TravelerSheet({ travelerId }: { travelerId: string }) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const { stack, close } = useRecordStack();

	const traveler = useQuery(
		trpc.travelers.byId.queryOptions({ id: travelerId }),
	);
	const suppliers = useQuery(trpc.suppliers.options.queryOptions({ q: "" }));

	const onError = (error: { message: string }) => toast.error(error.message);

	const archive = useMutation(
		trpc.travelers.archive.mutationOptions({
			onSuccess: async () => {
				await cache.traveler(travelerId);
				toast.success("Traveler archived.");
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.travelers.restore.mutationOptions({
			onSuccess: async () => {
				await cache.traveler(travelerId);
				toast.success("Traveler restored.");
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.travelers.purge.mutationOptions({
			onSuccess: async () => {
				await cache.removed({ kind: "traveler", id: travelerId });
				toast.success("Traveler deleted forever.");
				close();
			},
			onError,
		}),
	);

	const setLoyalty = useMutation(
		trpc.travelers.setLoyalty.mutationOptions({
			onSuccess: async () => {
				await cache.traveler(travelerId);
				toast.success("Loyalty programs saved.");
			},
			onError,
		}),
	);

	const saved = traveler.data?.loyalty;
	const [draft, setDraft] = useState<LoyaltyDraft[]>([]);

	useEffect(() => {
		if (!saved) return;
		setDraft(toDraft(saved));
	}, [saved]);

	const onBack = stack.length > 1 ? () => close() : undefined;

	if (traveler.isError) {
		return (
			<>
				<DetailSheetHeader
					title="Traveler"
					onBack={onBack}
					onClose={() => close()}
				/>
				<DetailSheetBody>
					<DetailSheetEmpty
						icon={Plane}
						title="Not found"
						description="This traveler does not exist, or belongs to another agency."
					/>
				</DetailSheetBody>
			</>
		);
	}

	const data = traveler.data;
	const archived = Boolean(data?.archivedAt);

	const strip = (rows: LoyaltyDraft[]) =>
		rows.map((row) => ({
			supplierId: row.supplierId,
			programName: row.programName,
			number: row.number,
		}));

	const dirty =
		Boolean(saved) &&
		JSON.stringify(strip(draft)) !==
			JSON.stringify(strip(toDraft(saved ?? [])));

	const canSave =
		dirty &&
		draft.every(
			(entry) => entry.programName.trim() !== "" && entry.number.trim() !== "",
		);

	return (
		<>
			<DetailSheetHeader
				title={data ? `${data.firstName} ${data.lastName}` : "Loading…"}
				description={data?.nationality ?? undefined}
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
												onClick={() => restore.mutate({ id: travelerId })}
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
												onClick={() => purge.mutate({ id: travelerId })}
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
											onClick={() => archive.mutate({ id: travelerId })}
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
						<DetailSheetProperty label="Customer">
							{data?.customerName ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Born">
							{data?.dateOfBirth ? <LocalDay date={data.dateOfBirth} /> : "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Gender">
							{data?.gender ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Document">
							{documentTypeLabel(data?.documentType ?? null)}
						</DetailSheetProperty>
						<DetailSheetProperty label="Number">
							{data?.documentNumber ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Issued by">
							{data?.documentIssuedCountry ?? "—"}
						</DetailSheetProperty>
						<DetailSheetProperty label="Expires">
							{data?.documentExpiresAt ? (
								<LocalDay date={data.documentExpiresAt} />
							) : (
								"—"
							)}
						</DetailSheetProperty>
						<DetailSheetProperty label="Created">
							{data ? <LocalRelativeTime date={data.createdAt} /> : "—"}
						</DetailSheetProperty>
					</DetailSheetProperties>
				</DetailSheetSection>

				{data?.dietaryNotes || data?.medicalNotes ? (
					<DetailSheetSection title="Care notes">
						<div className="space-y-2 text-sm">
							{data.dietaryNotes ? (
								<p>
									<span className="text-muted-foreground">Dietary: </span>
									{data.dietaryNotes}
								</p>
							) : null}
							{data.medicalNotes ? (
								<p>
									<span className="text-muted-foreground">Medical: </span>
									{data.medicalNotes}
								</p>
							) : null}
						</div>
					</DetailSheetSection>
				) : null}

				<DetailSheetSection title="Loyalty programs">
					<div className="space-y-2">
						{draft.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No programs on file.
							</p>
						) : null}

						{draft.map((entry) => (
							<div
								key={entry.key}
								className="grid grid-cols-[1fr_1fr_auto] gap-2"
							>
								<Select
									value={entry.supplierId}
									onValueChange={(value) =>
										setDraft((rows) =>
											rows.map((row) =>
												row.key === entry.key
													? { ...row, supplierId: value }
													: row,
											),
										)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Supplier" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NO_SUPPLIER}>No supplier</SelectItem>
										{(suppliers.data ?? []).map((supplier) => (
											<SelectItem key={supplier.id} value={supplier.id}>
												{supplier.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<div className="flex gap-2">
									<Input
										value={entry.programName}
										placeholder="Program"
										onChange={(event) =>
											setDraft((rows) =>
												rows.map((row) =>
													row.key === entry.key
														? { ...row, programName: event.target.value }
														: row,
												),
											)
										}
									/>
									<Input
										value={entry.number}
										placeholder="Number"
										onChange={(event) =>
											setDraft((rows) =>
												rows.map((row) =>
													row.key === entry.key
														? { ...row, number: event.target.value }
														: row,
												),
											)
										}
									/>
								</div>
								<Button
									variant="ghost"
									size="icon-sm"
									onClick={() =>
										setDraft((rows) =>
											rows.filter((row) => row.key !== entry.key),
										)
									}
								>
									<TrashCan />
									<span className="sr-only">Remove program</span>
								</Button>
							</div>
						))}

						<Button
							variant="outline"
							size="sm"
							disabled={draft.length >= 50}
							onClick={() =>
								setDraft((rows) => [
									...rows,
									{
										key: `new-${Date.now()}-${rows.length}`,
										supplierId: NO_SUPPLIER,
										programName: "",
										number: "",
									},
								])
							}
						>
							<Add data-icon="inline-start" />
							Add program
						</Button>
					</div>
				</DetailSheetSection>
			</DetailSheetBody>

			<SaveBar
				open={dirty}
				title="Loyalty programs changed"
				description="Saving replaces the whole list."
			>
				<Button
					size="sm"
					variant="outline"
					disabled={setLoyalty.isPending}
					onClick={() => setDraft(toDraft(saved ?? []))}
				>
					Reset
				</Button>
				<Button
					size="sm"
					disabled={!canSave || setLoyalty.isPending}
					onClick={() =>
						setLoyalty.mutate({
							id: travelerId,
							entries: draft.map((entry) => ({
								supplierId:
									entry.supplierId === NO_SUPPLIER ? null : entry.supplierId,
								programName: entry.programName.trim(),
								number: entry.number.trim(),
							})),
						})
					}
				>
					Save
				</Button>
			</SaveBar>
		</>
	);
}
