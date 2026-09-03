"use client";

import Archive from "@carbon/icons-react/es/Archive";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { useTableQuery } from "@crm/ui/hooks/use-table-query";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ListSearch } from "@/components/data-table/list-search";
import { SavedViewsMenu } from "@/components/data-table/saved-views-menu";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { OwnerCell } from "@/components/travel/owner-cell";
import { usePrefetchRecord } from "@/components/travel/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import {
	QUOTE_STATUSES,
	quoteStatusLabel,
} from "@/components/travel/status-labels";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/types";
import { QuotesBulkActions } from "./quotes-bulk-actions";
import { quotesSearchParams } from "./quotes-search-params";

type QuoteRow = RouterOutputs["quotes"]["list"]["rows"][number];

const COLUMNS: DataTableColumn<QuoteRow>[] = [
	{
		id: "folio",
		header: "Folio",
		sortable: true,
		hideable: false,
		width: "w-[14%]",
		cell: (row) => (
			<span className="font-medium tabular-nums">{row.folio}</span>
		),
	},
	{
		id: "customer",
		header: "Customer",
		width: "w-[22%]",
		cell: (row) => <span className="truncate">{row.customer.name}</span>,
	},
	{
		id: "status",
		header: "Status",
		width: "w-[11%]",
		hideBelow: "sm",
		cell: (row) => (
			<Badge variant="secondary">{quoteStatusLabel(row.status)}</Badge>
		),
	},
	{
		id: "destination",
		header: "Destination",
		width: "w-[16%]",
		hideBelow: "md",
		cell: (row) =>
			row.destination ? (
				<span className="truncate text-muted-foreground">
					{row.destination}
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "owner",
		header: "Owner",
		sortable: true,
		width: "w-[13%]",
		hideBelow: "lg",
		cell: (row) => <OwnerCell owner={row.owner} />,
	},
	{
		id: "optionCount",
		header: "Options",
		align: "right",
		width: "w-[8%]",
		hideBelow: "lg",
		cell: (row) => <span className="tabular-nums">{row.optionCount}</span>,
	},
	{
		id: "travelStartDate",
		header: "Travel",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "md",
		cell: (row) =>
			row.travelStartDate ? (
				<span className="text-muted-foreground">
					<LocalDay date={row.travelStartDate} />
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "createdAt",
		header: "Created",
		label: "Created date",
		sortable: true,
		align: "right",
		width: "w-[10%]",
		defaultHidden: true,
		cell: (row) => (
			<span className="text-muted-foreground">
				<LocalRelativeTime date={row.createdAt} />
			</span>
		),
	},
];

const ARCHIVED_COLUMN: DataTableColumn<QuoteRow> = {
	id: "archivedAt",
	header: "Archived",
	label: "Archived date",
	sortable: true,
	align: "right",
	width: "w-[12%]",
	cell: (row) => (
		<span className="text-muted-foreground">
			{row.archivedAt ? (
				<LocalRelativeTime date={row.archivedAt} />
			) : (
				<EmptyCellValue />
			)}
		</span>
	),
};

export function QuotesTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(quotesSearchParams);
	const { query, input, setArchived } = table;

	const quotes = useQuery({
		...trpc.quotes.list.queryOptions({
			...input,
			status: input.status as RouterInputs["quotes"]["list"]["status"],
		}),
		placeholderData: (previous) => previous,
	});
	const users = useQuery(trpc.users.list.queryOptions());

	const rows = quotes.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = quotes.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "status",
			label: "Status",
			options: QUOTE_STATUSES.filter(
				(option) => (facetCounts?.status?.[option.value] ?? 0) > 0,
			).map((option) => ({ value: option.value, label: option.label })),
		},
		{
			id: "owner",
			label: "Owner",
			options: [
				{ value: "unassigned", label: "Unassigned" },
				...(users.data ?? []).map((user) => ({
					value: user.id,
					label: user.name,
				})),
			].filter((option) => (facetCounts?.owner?.[option.value] ?? 0) > 0),
		},
	];

	const columns = useMemo(
		() => (input.archived ? [...COLUMNS, ARCHIVED_COLUMN] : COLUMNS),
		[input.archived],
	);

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search quotes by folio or customer…" />}
			actions={
				<>
					<SavedViewsMenu entity="QUOTE" table={table} />
					<Button
						variant={input.archived ? "contrast" : "outline"}
						size="sm"
						className="justify-start sm:justify-center"
						onClick={() => setArchived(!input.archived)}
					>
						<Archive data-icon="inline-start" />
						Archived
					</Button>
				</>
			}
			columns={columns}
			rows={rows}
			total={quotes.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<QuotesBulkActions
						ids={selection.ids}
						onDone={selection.clear}
						archived={input.archived}
					/>
				),
				rowLabel: (row) => row.folio,
			}}
			getRowId={(row) => row.id}
			loading={quotes.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "quote", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "quote", id: row.id })}
			empty={
				input.archived ? "No archived quotes." : "No quotes match this view."
			}
		/>
	);
}
