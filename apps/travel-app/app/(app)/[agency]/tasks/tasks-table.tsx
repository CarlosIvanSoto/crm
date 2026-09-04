"use client";

import { Badge } from "@crm/ui/components/badge";
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
import { LocalRelativeTime } from "@/components/local-date-time";
import {
	type RecordKind,
	useOpenRecord,
	useRecordSheetView,
} from "@/components/travel/record-sheet/record-stack";
import { taskWindowLabel } from "@/components/travel/status-labels";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { TasksBulkActions } from "./tasks-bulk-actions";
import { tasksSearchParams, toTaskListInput } from "./tasks-search-params";

type TaskRow = RouterOutputs["activities"]["tasks"]["rows"][number];

function anchorOf(row: TaskRow): { kind: RecordKind; id: string } | null {
	if (row.bookingId) return { kind: "booking", id: row.bookingId };
	if (row.quoteId) return { kind: "quote", id: row.quoteId };
	if (row.customerId) return { kind: "customer", id: row.customerId };
	return null;
}

const ANCHOR_LABEL = {
	booking: "Booking",
	quote: "Quote",
	customer: "Customer",
	traveler: "Traveler",
	supplier: "Supplier",
} satisfies Record<RecordKind, string>;

const COLUMNS: DataTableColumn<TaskRow>[] = [
	{
		id: "subject",
		header: "Task",
		hideable: false,
		width: "w-[40%]",
		cell: (row) => <span className="truncate font-medium">{row.subject}</span>,
	},
	{
		id: "anchor",
		header: "About",
		width: "w-[14%]",
		hideBelow: "md",
		cell: (row) => {
			const anchor = anchorOf(row);
			return (
				<span className="text-muted-foreground">
					{anchor ? ANCHOR_LABEL[anchor.kind] : <EmptyCellValue />}
				</span>
			);
		},
	},
	{
		id: "assignedTo",
		header: "Advisor",
		width: "w-[18%]",
		cell: (row) => (
			<span className="truncate text-muted-foreground">
				{row.assignedTo?.name ?? <EmptyCellValue />}
			</span>
		),
	},
	{
		id: "dueAt",
		header: "Due",
		label: "Due date",
		sortable: true,
		align: "right",
		width: "w-[16%]",
		cell: (row) => {
			if (row.dueAt === null) return <EmptyCellValue />;
			const overdue = new Date(row.dueAt) < new Date();
			return (
				<span className="inline-flex items-center gap-2">
					{overdue ? <Badge variant="destructive">Overdue</Badge> : null}
					<span className="text-muted-foreground">
						<LocalRelativeTime date={row.dueAt} />
					</span>
				</span>
			);
		},
	},
];

export function TasksTable() {
	const openRecord = useOpenRecord();
	const { setTab } = useRecordSheetView("overview");
	const trpc = useTRPC();
	const table = useTableQuery(tasksSearchParams);
	const { query, input } = table;

	const tasks = useQuery({
		...trpc.activities.tasks.queryOptions(toTaskListInput(input)),
		placeholderData: (previous) => previous,
	});
	const advisors = useQuery(trpc.users.list.queryOptions());

	const rows = tasks.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = tasks.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "assignedTo",
			label: "Advisor",
			options: (advisors.data ?? [])
				.filter((advisor) => (facetCounts?.assignedTo?.[advisor.id] ?? 0) > 0)
				.map((advisor) => ({ value: advisor.id, label: advisor.name })),
		},
	];

	const openAnchor = (row: TaskRow) => {
		const anchor = anchorOf(row);
		if (!anchor) return;
		openRecord(anchor);
		setTab("timeline");
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			<DataTable
				query={query}
				search={<ListSearch placeholder="Search tasks…" />}
				columns={COLUMNS}
				rows={rows}
				total={tasks.data?.total ?? 0}
				facetCounts={facetCounts}
				facets={facets}
				tabs={{
					id: "window",
					allLabel: "All",
					options: [
						{ value: "overdue", label: taskWindowLabel("overdue") },
						{ value: "today", label: taskWindowLabel("today") },
						{ value: "week", label: taskWindowLabel("week") },
					],
				}}
				selection={{
					state: selection,
					actions: (
						<TasksBulkActions ids={selection.ids} onDone={selection.clear} />
					),
					rowLabel: (row) => row.subject ?? "task",
				}}
				getRowId={(row) => row.id}
				loading={tasks.isFetching}
				onRowClick={openAnchor}
				empty="No tasks match this view."
			/>
		</div>
	);
}
