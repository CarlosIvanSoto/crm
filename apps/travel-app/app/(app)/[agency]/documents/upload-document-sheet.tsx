"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { put as putBlob } from "@vercel/blob/client";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
	DOCUMENT_KINDS,
	type DocumentAnchor,
} from "@/components/travel/documents/document-meta";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";

type DocumentKind = RouterInputs["documents"]["create"]["kind"];
type AnchorType = "booking" | "traveler";

const NO_RECORD = "none";

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			Upload document
		</Button>
	);
}

export function UploadDocumentSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<UploadDocumentForm />
		</Suspense>
	);
}

function UploadDocumentForm() {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const fileInput = useRef<HTMLInputElement>(null);

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [anchorType, setAnchorType] = useState<AnchorType>("booking");
	const [recordId, setRecordId] = useState(NO_RECORD);
	const [kind, setKind] = useState<DocumentKind>("OTHER");
	const [file, setFile] = useState<File | null>(null);
	const [progress, setProgress] = useState(0);

	const anchorId = useId();
	const recordFieldId = useId();
	const kindId = useId();

	const storage = useQuery(trpc.documents.storage.queryOptions());
	const bookings = useQuery(
		trpc.bookings.list.queryOptions({
			sort: "createdAt",
			dir: "desc",
			pageSize: 50,
		}),
	);
	const travelers = useQuery(trpc.travelers.options.queryOptions({ q: "" }));
	const uploadToken = useMutation(trpc.documents.uploadToken.mutationOptions());
	const createDocument = useMutation(trpc.documents.create.mutationOptions());

	const reset = () => {
		setAnchorType("booking");
		setRecordId(NO_RECORD);
		setKind("OTHER");
		setFile(null);
		setProgress(0);
		if (fileInput.current) fileInput.current.value = "";
	};

	const anchor: DocumentAnchor | null =
		recordId === NO_RECORD
			? null
			: anchorType === "booking"
				? { bookingId: recordId }
				: { travelerId: recordId };

	const submit = useMutation({
		mutationFn: async (picked: File) => {
			if (!anchor) throw new Error("Pick a booking or a traveler first.");

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
			await cache.document(anchor ?? undefined);
			toast.success("Document uploaded.");
			await setOpen(null);
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
	const valid = Boolean(anchor) && Boolean(file) && !tooLarge && !wrongType;

	if (!storage.data?.enabled) return null;

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>Upload a document</SheetTitle>
					<SheetDescription>
						A voucher, ticket, invoice or ID document, attached to a booking or
						a traveler.
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-4">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={anchorId}>Attach to</FieldLabel>
							<Select
								value={anchorType}
								onValueChange={(next) => {
									setAnchorType(next as AnchorType);
									setRecordId(NO_RECORD);
								}}
							>
								<SelectTrigger id={anchorId}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="booking">A booking</SelectItem>
									<SelectItem value="traveler">A traveler</SelectItem>
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={recordFieldId}>
								{anchorType === "booking" ? "Booking" : "Traveler"}
							</FieldLabel>
							<Select value={recordId} onValueChange={setRecordId}>
								<SelectTrigger id={recordFieldId}>
									<SelectValue placeholder="Pick one" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_RECORD}>Pick one</SelectItem>
									{anchorType === "booking"
										? (bookings.data?.rows ?? []).map((booking) => (
												<SelectItem key={booking.id} value={booking.id}>
													{booking.folio} · {booking.customer.name}
												</SelectItem>
											))
										: (travelers.data ?? []).map((traveler) => (
												<SelectItem key={traveler.id} value={traveler.id}>
													{traveler.firstName} {traveler.lastName}
												</SelectItem>
											))}
								</SelectContent>
							</Select>
						</Field>

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
				</div>

				<SheetFooter>
					<Button
						disabled={!valid || submit.isPending}
						onClick={() => file && submit.mutate(file)}
					>
						{submit.isPending ? <Spinner /> : null}
						{submit.isPending ? `Uploading… ${progress}%` : "Upload"}
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
