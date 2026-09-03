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
import { OwnerCell } from "@/components/travel/owner-cell";
import { usePrefetchRecord } from "@/components/travel/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs, RouterOutputs } from "@/lib/trpc/types";
import { CustomersBulkActions } from "./customers-bulk-actions";
import { customersSearchParams } from "./customers-search-params";

type CustomerRow = RouterOutputs["customers"]["list"]["rows"][number];

const TYPE_OPTIONS = [
	{ value: "PERSON", label: "Person" },
	{ value: "COMPANY", label: "Company" },
] as const;

function typeLabel(type: string): string {
	return type === "COMPANY" ? "Company" : "Person";
}

const COLUMNS: DataTableColumn<CustomerRow>[] = [
	{
		id: "name",
		header: "Name",
		sortable: true,
		hideable: false,
		width: "w-[28%]",
		cell: (row) => <span className="truncate font-medium">{row.name}</span>,
	},
	{
		id: "type",
		header: "Type",
		width: "w-[10%]",
		hideBelow: "lg",
		cell: (row) => (
			<span className="text-muted-foreground">{typeLabel(row.type)}</span>
		),
	},
	{
		id: "email",
		header: "Email",
		sortable: true,
		width: "w-[20%]",
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
		id: "owner",
		header: "Owner",
		sortable: true,
		width: "w-[15%]",
		hideBelow: "md",
		cell: (row) => <OwnerCell owner={row.owner} />,
	},
	{
		id: "quotes",
		header: "Quotes",
		align: "right",
		width: "w-[7%]",
		hideBelow: "lg",
		cell: (row) => <span className="tabular-nums">{row.quoteCount}</span>,
	},
	{
		id: "bookings",
		header: "Bookings",
		align: "right",
		width: "w-[7%]",
		hideBelow: "lg",
		cell: (row) => <span className="tabular-nums">{row.bookingCount}</span>,
	},
	{
		id: "lastActivity",
		header: "Last activity",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) => (
			<span className="text-muted-foreground">
				{row.lastActivityAt ? (
					<LocalRelativeTime date={row.lastActivityAt} />
				) : (
					<EmptyCellValue />
				)}
			</span>
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

const ARCHIVED_COLUMN: DataTableColumn<CustomerRow> = {
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

export function CustomersTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(customersSearchParams);
	const { query, input, setArchived } = table;

	const customers = useQuery({
		...trpc.customers.list.queryOptions({
			...input,
			type: input.type as RouterInputs["customers"]["list"]["type"],
		}),
		placeholderData: (previous) => previous,
	});
	const users = useQuery(trpc.users.list.queryOptions());

	const rows = customers.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = customers.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "type",
			label: "Type",
			options: TYPE_OPTIONS.filter(
				(option) => (facetCounts?.type?.[option.value] ?? 0) > 0,
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
			search={<ListSearch placeholder="Search customers by name or email…" />}
			actions={
				<>
					<SavedViewsMenu entity="CUSTOMER" table={table} />
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
			total={customers.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<CustomersBulkActions
						ids={selection.ids}
						onDone={selection.clear}
						archived={input.archived}
					/>
				),
				rowLabel: (row) => row.name,
			}}
			getRowId={(row) => row.id}
			loading={customers.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "customer", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "customer", id: row.id })}
			empty={
				input.archived
					? "No archived customers."
					: "No customers match this view."
			}
		/>
	);
}
