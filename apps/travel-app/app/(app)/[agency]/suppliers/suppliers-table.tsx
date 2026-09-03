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
import { LocalRelativeTime } from "@/components/local-date-time";
import { usePrefetchRecord } from "@/components/travel/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import {
	SUPPLIER_KINDS,
	supplierKindLabel,
} from "@/components/travel/supplier-kind";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/types";
import { SuppliersBulkActions } from "./suppliers-bulk-actions";
import { suppliersSearchParams } from "./suppliers-search-params";

type SupplierRow = RouterOutputs["suppliers"]["list"]["rows"][number];

const COLUMNS: DataTableColumn<SupplierRow>[] = [
	{
		id: "name",
		header: "Name",
		sortable: true,
		hideable: false,
		width: "w-[30%]",
		cell: (row) => <span className="truncate font-medium">{row.name}</span>,
	},
	{
		id: "kind",
		header: "Kind",
		width: "w-[14%]",
		hideBelow: "md",
		cell: (row) => (
			<span className="text-muted-foreground">
				{supplierKindLabel(row.kind)}
			</span>
		),
	},
	{
		id: "email",
		header: "Email",
		sortable: true,
		width: "w-[22%]",
		hideBelow: "md",
		cell: (row) =>
			row.email ? (
				<span className="truncate text-muted-foreground">{row.email}</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "phone",
		header: "Phone",
		width: "w-[13%]",
		hideBelow: "lg",
		cell: (row) =>
			row.phone ? (
				<span className="truncate text-muted-foreground">{row.phone}</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "defaultCurrency",
		header: "Currency",
		width: "w-[9%]",
		hideBelow: "lg",
		cell: (row) =>
			row.defaultCurrency ? (
				<span className="text-muted-foreground tabular-nums">
					{row.defaultCurrency}
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "quoteItemCount",
		header: "Quote lines",
		align: "right",
		width: "w-[8%]",
		hideBelow: "lg",
		cell: (row) => <span className="tabular-nums">{row.quoteItemCount}</span>,
	},
	{
		id: "bookingItemCount",
		header: "Booked lines",
		align: "right",
		width: "w-[8%]",
		hideBelow: "lg",
		cell: (row) => <span className="tabular-nums">{row.bookingItemCount}</span>,
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

const ARCHIVED_COLUMN: DataTableColumn<SupplierRow> = {
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

export function SuppliersTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(suppliersSearchParams);
	const { query, input, setArchived } = table;

	const suppliers = useQuery({
		...trpc.suppliers.list.queryOptions({
			...input,
			kind: input.kind as RouterInputs["suppliers"]["list"]["kind"],
		}),
		placeholderData: (previous) => previous,
	});

	const rows = suppliers.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = suppliers.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "kind",
			label: "Kind",
			options: SUPPLIER_KINDS.filter(
				(option) => (facetCounts?.kind?.[option.value] ?? 0) > 0,
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
			search={<ListSearch placeholder="Search suppliers by name or email…" />}
			actions={
				<>
					<SavedViewsMenu entity="SUPPLIER" table={table} />
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
			total={suppliers.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<SuppliersBulkActions
						ids={selection.ids}
						onDone={selection.clear}
						archived={input.archived}
					/>
				),
				rowLabel: (row) => row.name,
			}}
			getRowId={(row) => row.id}
			loading={suppliers.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "supplier", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "supplier", id: row.id })}
			empty={
				input.archived
					? "No archived suppliers."
					: "No suppliers match this view."
			}
		/>
	);
}
