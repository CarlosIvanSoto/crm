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
import { formatAmount, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ListSearch } from "@/components/data-table/list-search";
import { LocalRelativeTime } from "@/components/local-date-time";
import {
	COMMISSION_BASES,
	COMMISSION_STATUSES,
	commissionBasisLabel,
	commissionStatusLabel,
	commissionStatusVariant,
} from "@/components/travel/commissions/commission-meta";
import { usePrefetchRecord } from "@/components/travel/record-sheet/record-prefetch";
import {
	useOpenRecord,
	useRecordSheetView,
} from "@/components/travel/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CommissionsBulkActions } from "./commissions-bulk-actions";
import {
	commissionsSearchParams,
	toCommissionListInput,
} from "./commissions-search-params";

type CommissionRow = RouterOutputs["commissions"]["list"]["rows"][number];

const COLUMNS: DataTableColumn<CommissionRow>[] = [
	{
		id: "bookingFolio",
		header: "Booking",
		hideable: false,
		width: "w-[20%]",
		cell: (row) => (
			<span className="truncate font-medium">{row.bookingFolio}</span>
		),
	},
	{
		id: "userName",
		header: "Advisor",
		width: "w-[20%]",
		cell: (row) => (
			<span className="truncate text-muted-foreground">{row.userName}</span>
		),
	},
	{
		id: "basis",
		header: "Basis",
		width: "w-[10%]",
		hideBelow: "md",
		cell: (row) => (
			<span className="text-muted-foreground">
				{commissionBasisLabel(row.basis)}
			</span>
		),
	},
	{
		id: "rate",
		header: "Rate",
		align: "right",
		width: "w-[10%]",
		hideBelow: "lg",
		cell: (row) =>
			row.rate === null ? (
				<EmptyCellValue />
			) : (
				<span className="tabular-nums">{formatPercent(row.rate)}</span>
			),
	},
	{
		id: "amountBase",
		header: "Commission",
		label: "Commission amount",
		sortable: true,
		align: "right",
		width: "w-[16%]",
		cell: (row) =>
			row.amountBase === null ? (
				<span className="text-muted-foreground text-xs">No rate</span>
			) : (
				<span className="tabular-nums">
					{formatAmount(row.amountBase, row.baseCurrency ?? "usd")}
				</span>
			),
	},
	{
		id: "status",
		header: "Status",
		sortable: true,
		width: "w-[12%]",
		cell: (row) => (
			<Badge variant={commissionStatusVariant(row.status)}>
				{commissionStatusLabel(row.status)}
			</Badge>
		),
	},
	{
		id: "createdAt",
		header: "Created",
		label: "Created date",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		defaultHidden: true,
		cell: (row) => (
			<span className="text-muted-foreground">
				<LocalRelativeTime date={row.createdAt} />
			</span>
		),
	},
];

export function CommissionsTable() {
	const openRecord = useOpenRecord();
	const { setTab } = useRecordSheetView("overview");
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(commissionsSearchParams);
	const { query, input } = table;

	const commissions = useQuery({
		...trpc.commissions.list.queryOptions(toCommissionListInput(input)),
		placeholderData: (previous) => previous,
	});

	const rows = commissions.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = commissions.data?.facetCounts;
	const missingRate = commissions.data?.missingRate ?? 0;

	const facets: DataTableFacet[] = [
		{
			id: "status",
			label: "Status",
			options: COMMISSION_STATUSES.filter(
				(option) => (facetCounts?.status?.[option.value] ?? 0) > 0,
			).map((option) => ({ value: option.value, label: option.label })),
		},
		{
			id: "basis",
			label: "Basis",
			options: COMMISSION_BASES.filter(
				(option) => (facetCounts?.basis?.[option.value] ?? 0) > 0,
			).map((option) => ({ value: option.value, label: option.label })),
		},
	];

	const openBooking = (row: CommissionRow) => {
		openRecord({ kind: "booking", id: row.bookingId });
		setTab("commissions");
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			{missingRate > 0 ? (
				<p className="text-muted-foreground text-xs">
					{missingRate} {missingRate === 1 ? "row has" : "rows have"} no rate
					and
					{missingRate === 1 ? " is" : " are"} left out of every total.
				</p>
			) : null}
			<DataTable
				query={query}
				search={
					<ListSearch placeholder="Search commissions by folio, advisor or note…" />
				}
				columns={COLUMNS}
				rows={rows}
				total={commissions.data?.total ?? 0}
				facetCounts={facetCounts}
				facets={facets}
				selection={{
					state: selection,
					actions: (
						<CommissionsBulkActions
							ids={selection.ids}
							onDone={selection.clear}
						/>
					),
					rowLabel: (row) => `${row.bookingFolio} · ${row.userName}`,
				}}
				getRowId={(row) => row.id}
				loading={commissions.isFetching}
				onRowHover={(row) =>
					prefetchRecord({ kind: "booking", id: row.bookingId })
				}
				onRowClick={openBooking}
				empty="No commissions match this view."
			/>
		</div>
	);
}
