"use client";

import Archive from "@carbon/icons-react/es/Archive";
import DocumentBlank from "@carbon/icons-react/es/DocumentBlank";
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
import { draftFromOutput } from "@/components/travel/itinerary/types";
import { AgentPanel } from "@/components/travel/quotes/agent-panel";
import {
	newOption,
	OptionsEditor,
	type QuoteOptionDraft,
} from "@/components/travel/quotes/options-editor";
import { SharePanel } from "@/components/travel/quotes/share-panel";
import {
	QUOTE_STATUSES,
	quoteStatusLabel,
} from "@/components/travel/status-labels";
import { Timeline } from "@/components/travel/timeline/timeline";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	useOpenRecord,
	useRecordSheetView,
	useRecordStack,
} from "./record-stack";

type QuoteDetail = RouterOutputs["quotes"]["byId"];

function toDraft(quote: QuoteDetail): QuoteOptionDraft[] {
	return quote.options.map((option) => ({
		key: `saved-${option.id}`,
		id: option.id,
		label: option.label,
		isRecommended: option.isRecommended,
		items: option.items.map(draftFromOutput),
	}));
}

export function QuoteSheet({ quoteId }: { quoteId: string }) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const { stack, close } = useRecordStack();
	const openRecord = useOpenRecord();
	const view = useRecordSheetView("overview");

	const quote = useQuery(trpc.quotes.byId.queryOptions({ id: quoteId }));
	const suppliers = useQuery(trpc.suppliers.options.queryOptions({ q: "" }));

	const onError = (error: { message: string }) => toast.error(error.message);

	const update = useMutation(
		trpc.quotes.update.mutationOptions({
			onSuccess: async () => {
				await cache.quote(quoteId);
				toast.success("Quote updated.");
			},
			onError,
		}),
	);

	const archive = useMutation(
		trpc.quotes.archive.mutationOptions({
			onSuccess: async () => {
				await cache.quote(quoteId);
				toast.success("Quote archived.");
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.quotes.restore.mutationOptions({
			onSuccess: async () => {
				await cache.quote(quoteId);
				toast.success("Quote restored.");
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.quotes.purge.mutationOptions({
			onSuccess: async () => {
				await cache.removed({ kind: "quote", id: quoteId });
				toast.success("Quote deleted forever.");
				close();
			},
			onError,
		}),
	);

	const setOptions = useMutation(
		trpc.quotes.setOptions.mutationOptions({
			onSuccess: async () => {
				await cache.quote(quoteId);
				toast.success("Options saved.");
			},
			onError,
		}),
	);

	const accept = useMutation(
		trpc.quotes.accept.mutationOptions({
			onSuccess: async (result) => {
				await cache.quote(quoteId);
				await cache.booking(result.bookingId);
				toast.success(`Booking ${result.bookingFolio} created.`);
				openRecord({ kind: "booking", id: result.bookingId });
			},
			onError,
		}),
	);

	const savedOptions = quote.data?.options;
	const [draft, setDraft] = useState<QuoteOptionDraft[]>([]);

	useEffect(() => {
		if (!quote.data) return;
		setDraft(toDraft(quote.data));
	}, [quote.data]);

	const onBack = stack.length > 1 ? () => close() : undefined;

	if (quote.isError) {
		return (
			<>
				<DetailSheetHeader
					title="Quote"
					onBack={onBack}
					onClose={() => close()}
				/>
				<DetailSheetBody>
					<DetailSheetEmpty
						icon={DocumentBlank}
						title="Not found"
						description="This quote does not exist, or belongs to another agency."
					/>
				</DetailSheetBody>
			</>
		);
	}

	const data = quote.data;
	const archived = Boolean(data?.archivedAt);
	const supplierOptions = suppliers.data ?? [];

	const dirty =
		Boolean(savedOptions) &&
		JSON.stringify(
			draft.map((option) => ({
				id: option.id,
				label: option.label,
				isRecommended: option.isRecommended,
				items: option.items.map((item) => ({ ...item, key: "" })),
			})),
		) !==
			JSON.stringify(
				(data ? toDraft(data) : []).map((option) => ({
					id: option.id,
					label: option.label,
					isRecommended: option.isRecommended,
					items: option.items.map((item) => ({ ...item, key: "" })),
				})),
			);

	const canSave =
		dirty &&
		draft.length >= 1 &&
		draft.every((option) => option.label.trim() !== "");

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
										id: quoteId,
										data: {
											status: value as (typeof QUOTE_STATUSES)[number]["value"],
										},
									})
								}
							>
								<SelectTrigger className="h-7 w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{QUOTE_STATUSES.map((option) => (
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
					<DetailSheetProperty label="Valid until">
						{data?.validUntil ? <LocalDay date={data.validUntil} /> : "—"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Pax">
						{data
							? `${data.paxAdults} + ${data.paxChildren} ch + ${data.paxInfants} inf`
							: "—"}
					</DetailSheetProperty>
					<DetailSheetProperty label="Created">
						{data ? <LocalRelativeTime date={data.createdAt} /> : "—"}
					</DetailSheetProperty>
				</DetailSheetProperties>
			</DetailSheetSection>

			<DetailSheetSection title="Options">
				<div className="space-y-2">
					{(data?.options ?? []).map((option) => (
						<div
							key={option.id}
							className="flex items-center justify-between gap-3 rounded-md border p-2"
						>
							<div className="min-w-0">
								<p className="truncate font-medium text-sm">
									{option.label}
									{option.isRecommended ? (
										<span className="ml-2 text-muted-foreground text-xs">
											recommended
										</span>
									) : null}
								</p>
								<p className="text-muted-foreground text-xs">
									{option.sellTotalBase != null && option.baseCurrency
										? formatAmount(option.sellTotalBase, option.baseCurrency)
										: "No price"}
									{option.unpricedItems > 0
										? ` · ${option.unpricedItems} unpriced`
										: ""}
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								disabled={accept.isPending || data?.status === "ACCEPTED"}
								onClick={() =>
									accept.mutate({ id: quoteId, optionId: option.id })
								}
							>
								Accept
							</Button>
						</div>
					))}
					{(data?.options.length ?? 0) === 0 ? (
						<p className="text-muted-foreground text-sm">
							No options yet. Add them in the Options tab.
						</p>
					) : null}
				</div>
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const optionsTab = (
		<DetailSheetBody>
			<DetailSheetSection>
				<OptionsEditor
					options={draft.length === 0 ? [newOption()] : draft}
					onChange={setDraft}
					suppliers={supplierOptions}
				/>
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const shareTab = (
		<DetailSheetBody>
			<DetailSheetSection>
				<SharePanel quoteId={quoteId} />
			</DetailSheetSection>
		</DetailSheetBody>
	);

	const timelineTab = <Timeline anchor={{ quoteId }} />;

	const agentTab = <AgentPanel quoteId={quoteId} />;

	return (
		<>
			<DetailSheetHeader
				title={data?.folio ?? "Loading…"}
				description={data ? quoteStatusLabel(data.status) : undefined}
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
												onClick={() => restore.mutate({ id: quoteId })}
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
												onClick={() => purge.mutate({ id: quoteId })}
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
											onClick={() => archive.mutate({ id: quoteId })}
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
						value: "options",
						label: "Options",
						count: data?.options.length ?? null,
						content: optionsTab,
						keepMounted: true,
					},
					{
						value: "share",
						label: "Share",
						content: shareTab,
						keepMounted: true,
					},
					{
						value: "agent",
						label: "Agent",
						content: agentTab,
						keepMounted: true,
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
				open={dirty}
				title="Options changed"
				description="Saving replaces every option and line."
			>
				<Button
					size="sm"
					variant="outline"
					disabled={setOptions.isPending}
					onClick={() => data && setDraft(toDraft(data))}
				>
					Reset
				</Button>
				<Button
					size="sm"
					disabled={!canSave || setOptions.isPending}
					onClick={() =>
						setOptions.mutate({
							id: quoteId,
							options: draft.map((option, index) => ({
								label: option.label.trim(),
								position: index,
								isRecommended: option.isRecommended,
								items: option.items.map((item, at) => ({
									type: item.type,
									supplierId: item.supplierId,
									confirmationCode: item.confirmationCode,
									status: item.status,
									startsAt: item.startsAt,
									endsAt: item.endsAt,
									startLocation: item.startLocation,
									endLocation: item.endLocation,
									description: item.description,
									paxCount: item.paxCount,
									position: at,
									costAmount: item.costAmount,
									costCurrency: item.costCurrency,
									sellAmount: item.sellAmount,
									sellCurrency: item.sellCurrency,
									details: item.details,
								})),
							})),
						})
					}
				>
					Save options
				</Button>
			</SaveBar>
		</>
	);
}
