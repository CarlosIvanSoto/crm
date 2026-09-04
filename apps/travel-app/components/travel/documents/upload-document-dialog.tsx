"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { put as putBlob } from "@vercel/blob/client";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";
import { DOCUMENT_KINDS, type DocumentAnchor } from "./document-meta";

type DocumentKind = RouterInputs["documents"]["create"]["kind"];

export function UploadDocumentDialog({
	anchor,
	open,
	onOpenChange,
}: {
	anchor: DocumentAnchor;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const fileInput = useRef<HTMLInputElement>(null);
	const kindId = useId();

	const [file, setFile] = useState<File | null>(null);
	const [kind, setKind] = useState<DocumentKind>("OTHER");
	const [progress, setProgress] = useState(0);

	const storage = useQuery(trpc.documents.storage.queryOptions());
	const uploadToken = useMutation(trpc.documents.uploadToken.mutationOptions());
	const createDocument = useMutation(trpc.documents.create.mutationOptions());

	const reset = () => {
		setFile(null);
		setKind("OTHER");
		setProgress(0);
		if (fileInput.current) fileInput.current.value = "";
	};

	const submit = useMutation({
		mutationFn: async (picked: File) => {
			const { token, pathname } = await uploadToken.mutateAsync({
				...anchor,
				filename: picked.name,
				contentType: picked.type,
				sizeBytes: picked.size,
				kind,
			});

			const blob = await putBlob(pathname, picked, {
				access: "private",
				token,
				contentType: picked.type,
				onUploadProgress: (event) => setProgress(event.percentage),
			});

			return createDocument.mutateAsync({
				...anchor,
				kind,
				pathname,
				url: blob.url,
				filename: picked.name,
				contentType: picked.type || null,
				sizeBytes: picked.size,
			});
		},
		onSuccess: async () => {
			await cache.document(anchor);
			toast.success("Document uploaded.");
			onOpenChange(false);
			reset();
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Upload failed.");
		},
	});

	const maxBytes = storage.data?.maxBytes ?? 0;
	const allowedTypes = storage.data?.allowedContentTypes ?? [];
	const tooLarge = Boolean(file && maxBytes > 0 && file.size > maxBytes);
	const wrongType = Boolean(
		file && allowedTypes.length > 0 && !allowedTypes.includes(file.type),
	);
	const valid = Boolean(file) && !tooLarge && !wrongType;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) reset();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Upload a document</DialogTitle>
					<DialogDescription>
						A voucher, ticket, invoice or ID document. Up to{" "}
						{Math.round(maxBytes / (1024 * 1024))} MB.
					</DialogDescription>
				</DialogHeader>

				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={kindId}>Kind</FieldLabel>
						<Select
							value={kind}
							onValueChange={(next) => setKind(next as DocumentKind)}
						>
							<SelectTrigger id={kindId}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DOCUMENT_KINDS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					<Field>
						<FieldLabel>File</FieldLabel>
						<input
							ref={fileInput}
							type="file"
							className="hidden"
							onChange={(event) => {
								setFile(event.currentTarget.files?.[0] ?? null);
								setProgress(0);
							}}
						/>
						<Button
							type="button"
							variant="outline"
							onClick={() => fileInput.current?.click()}
						>
							{file ? file.name : "Choose file"}
						</Button>
						{tooLarge ? (
							<p className="text-destructive text-sm">
								That file is too large.
							</p>
						) : null}
						{wrongType ? (
							<p className="text-destructive text-sm">
								That file type cannot be uploaded here.
							</p>
						) : null}
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button
						disabled={!valid || submit.isPending}
						onClick={() => file && submit.mutate(file)}
					>
						{submit.isPending ? <Spinner /> : null}
						{submit.isPending ? `Uploading… ${progress}%` : "Upload"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
