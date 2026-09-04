"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Delivery from "@carbon/icons-react/es/Delivery";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Undo from "@carbon/icons-react/es/Undo";
import { Button } from "@crm/ui/components/button";
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
import { formatAmount } from "@crm/ui/lib/format";
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
	DetailSheetTabs,
} from "@/components/detail-sheet";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import {
	type BookingTravelerDraft,
	newTraveler,
	TravelersEditor,
} from "@/components/travel/bookings/travelers-editor";
import { CommissionsPanel } from "@/components/travel/commissions/commissions-panel";
import { DocumentsPanel } from "@/components/travel/documents/documents-panel";
import { ItemsEditor } from "@/components/travel/itinerary/items-editor";
import {
	draftFromOutput,
	type ItineraryDraft,
	toItemInput,
} from "@/components/travel/itinerary/types";
import { PaymentsPanel } from "@/components/travel/payments/payments-panel";
import {
	BOOKING_STATUSES,
	bookingStatusLabel,
} from "@/components/travel/status-labels";
import { Timeline } from "@/components/travel/timeline/timeline";
import {
	canManageCommission,
	canRecordPayment,
	canSeeMargins,
} from "@/lib/roles";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/types";
import { useRecordSheetView, useRecordStack } from "./record-stack";

type BookingDetail = RouterOutputs["bookings"]["byId"];
type SetTravelerInput = NonNullable<
	RouterInputs["bookings"]["setTravelers"]["travelers"]
>[number];

function itemsToDraft(booking: BookingDetail): ItineraryDraft[] {
	return booking.items.map(draftFromOutput);
}

function travelersToDraft(booking: BookingDetail): BookingTravelerDraft[] {
	return booking.travelers.map((traveler) => ({
		key: `saved-${traveler.id}`,
		firstName: traveler.firstName,
		lastName: traveler.lastName,
		dateOfBirth: null,
		nationality: null,
		documentType: null,
		documentNumber: traveler.documentNumber,
		documentExpiresAt: traveler.documentExpiresAt,
		paxType: traveler.paxType,
		isLead: traveler.isLead,
	}));
}

function stripItems(items: ItineraryDraft[]) {
	return JSON.stringify(items.map((item) => ({ ...item, key: "" })));
}

function stripTravelers(travelers: BookingTravelerDraft[]) {
	return JSON.stringify(travelers.map((row) => ({ ...row, key: "" })));
}

export function BookingSheet({ bookingId }: { bookingId: string }) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const { stack, close } = useRecordStack();
	const view = useRecordSheetView("overview");

	const booking = useQuery(trpc.bookings.byId.queryOptions({ id: bookingId }));
	const suppliers = useQuery(trpc.suppliers.options.queryOptions({ q: "" }));
	const me = useQuery(trpc.users.me.queryOptions());

	const canRecord = canRecordPayment(me.data?.role ?? null);
	const canManageCommissions = canManageCommission(me.data?.role ?? null);
	const canManageAllDocuments = canSeeMargins(me.data?.role ?? null);

	const onError = (error: { message: string }) => toast.error(error.message);

	const update = useMutation(
		trpc.bookings.update.mutationOptions({
			onSuccess: async () => {
				await cache.booking(bookingId);
				toast.success("Booking updated.");
			},
			onError,
		}),
	);
	const archive = useMutation(
		trpc.bookings.archive.mutationOptions({
			onSuccess: async () => {
				await cache.booking(bookingId);
				toast.success("Booking archived.");
			},
			onError,
		}),
	);
	const restore = useMutation(
		trpc.bookings.restore.mutationOptions({
			onSuccess: async () => {
				await cache.booking(bookingId);
				toast.success("Booking restored.");
			},
			onError,
		}),
	);
	const purge = useMutation(
		trpc.bookings.purge.mutationOptions({
			onSuccess: async () => {
				await cache.removed({ kind: "booking", id: bookingId });
				toast.success("Booking deleted forever.");
				close();
			},
			onError,
		}),
	);
	const setItems = useMutation(
		trpc.bookings.setItems.mutationOptions({
			onSuccess: async () => {
				await cache.booking(bookingId);
				toast.success("Itinerary saved.");
			},
			onError,
		}),
	);
	const setTravelers = useMutation(
		trpc.bookings.setTravelers.mutationOptions({
			onSuccess: async () => {
				await cache.booking(bookingId);
				toast.success("Travelers saved.");
			},
			onError,
		}),
	);

	const [itemDraft, setItemDraft] = useState<ItineraryDraft[]>([]);
	const [travelerDraft, setTravelerDraft] = useState<BookingTravelerDraft[]>(
		[],
	);

	useEffect(() => {
		if (!booking.data) return;
		setItemDraft(itemsToDraft(booking.data));
		setTravelerDraft(travelersToDraft(booking.data));
	}, [booking.data]);

	const onBack = stack.length > 1 ? () => close() : undefined;

	if (booking.isError) {
		return (
			<>
				<DetailSheetHeader
					title="Booking"
					onBack={onBack}
					onClose={() => close()}
				/>
				<DetailSheetBody>
					<DetailSheetEmpty
						icon={Delivery}
						title="Not found"
						description="This booking does not exist, or belongs to another agency."
					/>
				</DetailSheetBody>
			</>
		);
	}

	const data = booking.data;
	const archived = Boolean(data?.archivedAt);
	const supplierOptions = suppliers.data ?? [];

	const itemsDirty =
		Boolean(data) &&
		stripItems(itemDraft) !== stripItems(data ? itemsToDraft(data) : []);
	const travelersDirty =
		Boolean(data) &&
		stripTravelers(travelerDraft) !==
			stripTravelers(data ? travelersToDraft(data) : []);

	const overview = (
		<DetailSheetBody>
			<DetailSheetSection title="Details">
				<DetailSheetProperties>
					<DetailSheetProperty label="Customer">
						{data?.customer.name ?? "—"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Status">
						{data ? (
							<Select
								value={data.status}
								onValueChange={(value) =>
									update.mutate({
										id: bookingId,
										data: {
											status:
												value as (typeof BOOKING_STATUSES)[number]["value"],
										},
									})
								}
							>
								<SelectTrigger className="h-7 w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BOOKING_STATUSES.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							"—"
						)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Owner">
						{data?.owner?.name ?? "Unassigned"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Destination">
						{data?.destination ?? "—"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Travel">
						{data?.travelStartDate ? (
							<LocalDay date={data.travelStartDate} />
						) : (
							"—"
						)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Sold">
						{data?.sellTotalBase != null && data.baseCurrency
							? formatAmount(data.sellTotalBase, data.baseCurrency)
							: "—"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Cost">
						{data?.costTotalBase != null && data.baseCurrency
							? formatAmount(data.costTotalBase, data.baseCurrency)
							: "—"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Margin">
						{data?.marginBase != null && data.baseCurrency
							? formatAmount(data.marginBase, data.baseCurrency)
							: "—"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Unpriced lines">
						{data?.unpricedItems ?? 0}
					</DetailSheetProperty>
					<DetailSheetProperty label="Created">
						{data ? <LocalRelativeTime date={data.createdAt} /> : "—"}
					</DetailSheetProperty>
				</DetailSheetProperties>
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const itineraryTab = (
		<DetailSheetBody>
			<DetailSheetSection>
				<ItemsEditor
					items={itemDraft}
					onChange={setItemDraft}
					suppliers={supplierOptions}
				/>
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const travelersTab = (
		<DetailSheetBody>
			<DetailSheetSection>
				<TravelersEditor
					travelers={travelerDraft}
					onChange={setTravelerDraft}
				/>
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const paymentsTab = (
		<DetailSheetBody>
			<DetailSheetSection>
				<PaymentsPanel
					bookingId={bookingId}
					kind="all"
					statuses={[]}
					canRecord={canRecord}
				/>
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const commissionsTab = (
		<DetailSheetBody>
			<DetailSheetSection>
				<CommissionsPanel
					bookingId={bookingId}
					canManage={canManageCommissions}
				/>
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const documentsTab = (
		<DetailSheetBody>
			<DetailSheetSection>
				{me.data ? (
					<DocumentsPanel
						anchor={{ bookingId }}
						viewerId={me.data.id}
						canManageAll={canManageAllDocuments}
					/>
				) : null}
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const timelineTab = <Timeline anchor={{ bookingId }} />;

	return (
		<>
			<DetailSheetHeader
				title={data?.folio ?? "Loading…"}
				description={data ? bookingStatusLabel(data.status) : undefined}
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
												onClick={() => restore.mutate({ id: bookingId })}
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
												onClick={() => purge.mutate({ id: bookingId })}
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
											onClick={() => archive.mutate({ id: bookingId })}
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

			<DetailSheetTabs
				value={view.tab}
				onValueChange={view.setTab}
				tabs={[
					{ value: "overview", label: "Overview", content: overview },
					{
						value: "itinerary",
						label: "Itinerary",
						count: data?.itemCount ?? null,
						content: itineraryTab,
						keepMounted: true,
					},
					{
						value: "travelers",
						label: "Travelers",
						count: data?.travelerCount ?? null,
						content: travelersTab,
						keepMounted: true,
					},
					{
						value: "payments",
						label: "Payments",
						content: paymentsTab,
					},
					{
						value: "commissions",
						label: "Commissions",
						content: commissionsTab,
					},
					{
						value: "documents",
						label: "Documents",
						count: data?.documentCount ?? null,
						content: documentsTab,
					},
					{
						value: "timeline",
						label: "Timeline",
						content: timelineTab,
						keepMounted: true,
					},
				]}
			/>

			<SaveBar
				open={itemsDirty || travelersDirty}
				title={
					itemsDirty && travelersDirty
						? "Itinerary and travelers changed"
						: itemsDirty
							? "Itinerary changed"
							: "Travelers changed"
				}
				description="Saving replaces the whole set."
			>
				<Button
					size="sm"
					variant="outline"
					disabled={setItems.isPending || setTravelers.isPending}
					onClick={() => {
						if (!data) return;
						setItemDraft(itemsToDraft(data));
						setTravelerDraft(travelersToDraft(data));
					}}
				>
					Reset
				</Button>
				{itemsDirty ? (
					<Button
						size="sm"
						disabled={setItems.isPending}
						onClick={() =>
							setItems.mutate({
								id: bookingId,
								items: itemDraft.map((item, index) => toItemInput(item, index)),
							})
						}
					>
						Save itinerary
					</Button>
				) : null}
				{travelersDirty ? (
					<Button
						size="sm"
						disabled={setTravelers.isPending}
						onClick={() =>
							setTravelers.mutate({
								id: bookingId,
								travelers: travelerDraft.map((row) => ({
									firstName: row.firstName.trim(),
									lastName: row.lastName.trim(),
									dateOfBirth: row.dateOfBirth,
									nationality: row.nationality,
									documentType:
										row.documentType as SetTravelerInput["documentType"],
									documentNumber: row.documentNumber,
									documentExpiresAt: row.documentExpiresAt,
									paxType: row.paxType,
									isLead: row.isLead,
								})),
							})
						}
					>
						Save travelers
					</Button>
				) : null}
			</SaveBar>
		</>
	);
}
