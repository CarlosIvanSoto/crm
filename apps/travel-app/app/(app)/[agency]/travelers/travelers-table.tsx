"use client";

import Archive from "@carbon/icons-react/es/Archive";
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
import {
	DOCUMENT_TYPES,
	documentTypeLabel,
} from "@/components/travel/document-type";
import { usePrefetchRecord } from "@/components/travel/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/types";
import { TravelersBulkActions } from "./travelers-bulk-actions";
import { travelersSearchParams } from "./travelers-search-params";

type TravelerRow = RouterOutputs["travelers"]["list"]["rows"][number];

const COLUMNS: DataTableColumn<TravelerRow>[] = [
	{
		id: "lastName",
		header: "Name",
		sortable: true,
		hideable: false,
		width: "w-[24%]",
		cell: (row) => (
			<span className="truncate font-medium">
				{row.firstName} {row.lastName}
			</span>
		),
	},
	{
		id: "customer",
		header: "Customer",
		width: "w-[20%]",
		hideBelow: "md",
		cell: (row) =>
			row.customerName ? (
				<span className="truncate text-muted-foreground">
					{row.customerName}
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "nationality",
		header: "Nationality",
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) =>
			row.nationality ? (
				<span className="text-muted-foreground">{row.nationality}</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "documentType",
		header: "Document",
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) =>
			row.documentType ? (
				<span className="text-muted-foreground">
					{documentTypeLabel(row.documentType)}
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "documentExpiresAt",
		header: "Doc expiry",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) =>
			row.documentExpiresAt ? (
				<span className="text-muted-foreground">
					<LocalDay date={row.documentExpiresAt} />
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "bookingCount",
		header: "Bookings",
		align: "right",
		width: "w-[8%]",
		hideBelow: "lg",
		cell: (row) => <span className="tabular-nums">{row.bookingCount}</span>,
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

const ARCHIVED_COLUMN: DataTableColumn<TravelerRow> = {
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

export function TravelersTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(travelersSearchParams);
	const { query, input, setArchived } = table;

	const travelers = useQuery({
		...trpc.travelers.list.queryOptions({
			...input,
			documentType:
				input.documentType as RouterInputs["travelers"]["list"]["documentType"],
		}),
		placeholderData: (previous) => previous,
	});
	const customers = useQuery(trpc.customers.options.queryOptions({ q: "" }));

	const rows = travelers.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = travelers.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "customer",
			label: "Customer",
			options: (customers.data ?? [])
				.map((customer) => ({ value: customer.id, label: customer.name }))
				.filter((option) => (facetCounts?.customer?.[option.value] ?? 0) > 0),
		},
		{
			id: "documentType",
			label: "Document",
			options: DOCUMENT_TYPES.filter(
				(option) => (facetCounts?.documentType?.[option.value] ?? 0) > 0,
			).map((option) => ({ value: option.value, label: option.label })),
		},
	];

	const columns = useMemo(
		() => (input.archived ? [...COLUMNS, ARCHIVED_COLUMN] : COLUMNS),
		[input.archived],
	);

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search travelers by name…" />}
			actions={
				<>
					<SavedViewsMenu entity="TRAVELER" table={table} />
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
			total={travelers.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<TravelersBulkActions
						ids={selection.ids}
						onDone={selection.clear}
						archived={input.archived}
					/>
				),
				rowLabel: (row) => `${row.firstName} ${row.lastName}`,
			}}
			getRowId={(row) => row.id}
			loading={travelers.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "traveler", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "traveler", id: row.id })}
			empty={
				input.archived
					? "No archived travelers."
					: "No travelers match this view."
			}
		/>
	);
}
