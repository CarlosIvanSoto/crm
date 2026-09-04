"use client";

import { Badge } from "@crm/ui/components/badge";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { useTableQuery } from "@crm/ui/hooks/use-table-query";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ListSearch } from "@/components/data-table/list-search";
import { LocalRelativeTime } from "@/components/local-date-time";
import {
	DOCUMENT_KINDS,
	documentKindLabel,
	formatBytes,
} from "@/components/travel/documents/document-meta";
import { usePrefetchRecord } from "@/components/travel/record-sheet/record-prefetch";
import type { RecordRef } from "@/components/travel/record-sheet/record-stack";
import {
	useOpenRecord,
	useRecordSheetView,
} from "@/components/travel/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { DocumentsBulkActions } from "./documents-bulk-actions";
import {
	documentsSearchParams,
	toDocumentListInput,
} from "./documents-search-params";

type DocumentRow = RouterOutputs["documents"]["list"]["rows"][number];

function anchorRef(row: DocumentRow): RecordRef | null {
	if (row.bookingId) return { kind: "booking", id: row.bookingId };
	if (row.travelerId) return { kind: "traveler", id: row.travelerId };
	return null;
}

const COLUMNS: DataTableColumn<DocumentRow>[] = [
	{
		id: "filename",
		header: "File",
		hideable: false,
		width: "w-[28%]",
		cell: (row) => <span className="truncate font-medium">{row.filename}</span>,
	},
	{
		id: "kind",
		header: "Kind",
		width: "w-[14%]",
		cell: (row) => (
			<Badge variant="outline">{documentKindLabel(row.kind)}</Badge>
		),
	},
	{
		id: "anchor",
		header: "On",
		width: "w-[14%]",
		hideBelow: "md",
		cell: (row) => (
			<span className="text-muted-foreground">
				{row.bookingId ? "Booking" : "Traveler"}
			</span>
		),
	},
	{
		id: "sizeBytes",
		header: "Size",
		align: "right",
		width: "w-[10%]",
		hideBelow: "lg",
		cell: (row) => (
			<span className="tabular-nums text-muted-foreground">
				{formatBytes(row.sizeBytes)}
			</span>
		),
	},
	{
		id: "uploadedBy",
		header: "Uploaded by",
		width: "w-[16%]",
		hideBelow: "lg",
		cell: (row) => (
			<span className="truncate text-muted-foreground">
				{row.uploadedBy.name}
			</span>
		),
	},
	{
		id: "createdAt",
		header: "Uploaded",
		label: "Upload date",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		cell: (row) => (
			<span className="text-muted-foreground">
				<LocalRelativeTime date={row.createdAt} />
			</span>
		),
	},
];

export function DocumentsTable() {
	const openRecord = useOpenRecord();
	const { setTab } = useRecordSheetView("overview");
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(documentsSearchParams);
	const { query, input } = table;

	const documents = useQuery({
		...trpc.documents.list.queryOptions(toDocumentListInput(input)),
		placeholderData: (previous) => previous,
	});

	const rows = documents.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = documents.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "kind",
			label: "Kind",
			options: DOCUMENT_KINDS.filter(
				(option) => (facetCounts?.kind?.[option.value] ?? 0) > 0,
			).map((option) => ({ value: option.value, label: option.label })),
		},
	];

	const openAnchor = (row: DocumentRow) => {
		const ref = anchorRef(row);
		if (!ref) return;
		openRecord(ref);
		setTab("documents");
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			<DataTable
				query={query}
				search={<ListSearch placeholder="Search documents by filename…" />}
				columns={COLUMNS}
				rows={rows}
				total={documents.data?.total ?? 0}
				facetCounts={facetCounts}
				facets={facets}
				selection={{
					state: selection,
					actions: (
						<DocumentsBulkActions
							ids={selection.ids}
							onDone={selection.clear}
						/>
					),
					rowLabel: (row) => row.filename,
				}}
				getRowId={(row) => row.id}
				loading={documents.isFetching}
				onRowHover={(row) => {
					const ref = anchorRef(row);
					if (ref) prefetchRecord(ref);
				}}
				onRowClick={openAnchor}
				empty="No documents match this view."
			/>
		</div>
	);
}
