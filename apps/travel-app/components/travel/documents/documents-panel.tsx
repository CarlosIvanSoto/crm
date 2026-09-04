"use client";

import Add from "@carbon/icons-react/es/Add";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useDownloadDocument } from "./document-download";
import {
	type DocumentAnchor,
	documentKindLabel,
	formatBytes,
} from "./document-meta";
import { UploadDocumentDialog } from "./upload-document-dialog";

type DocumentRow = RouterOutputs["documents"]["list"]["rows"][number];

type Props = {
	anchor: DocumentAnchor;
	viewerId: string;
	canManageAll: boolean;
};

export function DocumentsPanel({ anchor, viewerId, canManageAll }: Props) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const [uploading, setUploading] = useState(false);
	const [renaming, setRenaming] = useState<DocumentRow | null>(null);
	const { download, pending } = useDownloadDocument();

	const storage = useQuery(trpc.documents.storage.queryOptions());
	const documents = useQuery({
		...trpc.documents.list.queryOptions({ ...anchor }),
		placeholderData: (previous) => previous,
	});

	const onError = (error: { message: string }) => toast.error(error.message);
	const onSettled = async (message: string) => {
		await cache.document(anchor);
		toast.success(message);
	};

	const remove = useMutation(
		trpc.documents.remove.mutationOptions({
			onSuccess: () => onSettled("Document removed."),
			onError,
		}),
	);

	const rows = documents.data?.rows ?? [];

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-end">
				{storage.data?.enabled ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setUploading(true)}
					>
						<Add data-icon="inline-start" />
						Upload
					</Button>
				) : null}
			</div>

			<div className="divide-y rounded-lg border">
				{rows.length === 0 ? (
					<p className="p-3 text-muted-foreground text-sm">No documents.</p>
				) : null}
				{rows.map((row) => {
					const canRemove = canManageAll || row.uploadedBy.id === viewerId;
					return (
						<div key={row.id} className="flex items-center gap-3 p-3 text-sm">
							<Badge variant="outline">{documentKindLabel(row.kind)}</Badge>
							<span className="min-w-0 truncate">{row.filename}</span>
							<span className="text-muted-foreground">
								{formatBytes(row.sizeBytes)}
							</span>
							<span className="text-muted-foreground">
								{row.uploadedBy.name} ·{" "}
								<LocalRelativeTime date={row.createdAt} />
							</span>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="sm" className="ml-auto">
										Actions
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										disabled={pending(row.id)}
										onSelect={() => download(row.id)}
									>
										Download
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => setRenaming(row)}>
										Rename
									</DropdownMenuItem>
									{canRemove ? (
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => remove.mutate({ id: row.id })}
										>
											Remove
										</DropdownMenuItem>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					);
				})}
			</div>

			<UploadDocumentDialog
				anchor={anchor}
				open={uploading}
				onOpenChange={setUploading}
			/>

			<RenameDialog
				anchor={anchor}
				row={renaming}
				onOpenChange={(open) => !open && setRenaming(null)}
			/>
		</div>
	);
}

function RenameDialog({
	anchor,
	row,
	onOpenChange,
}: {
	anchor: DocumentAnchor;
	row: DocumentRow | null;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const filenameId = useId();
	const [filename, setFilename] = useState(row?.filename ?? "");

	useEffect(() => {
		if (row) setFilename(row.filename);
	}, [row]);

	const update = useMutation(
		trpc.documents.update.mutationOptions({
			onSuccess: async () => {
				await cache.document(anchor);
				toast.success("Document renamed.");
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Dialog open={row !== null} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename document</DialogTitle>
					<DialogDescription>
						Change how this file is labeled.
					</DialogDescription>
				</DialogHeader>

				<Field>
					<FieldLabel htmlFor={filenameId}>Filename</FieldLabel>
					<Input
						id={filenameId}
						value={filename}
						onChange={(event) => setFilename(event.target.value)}
					/>
				</Field>

				<DialogFooter>
					<Button
						disabled={!row || filename.trim() === "" || update.isPending}
						onClick={() =>
							row && update.mutate({ id: row.id, filename: filename.trim() })
						}
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
