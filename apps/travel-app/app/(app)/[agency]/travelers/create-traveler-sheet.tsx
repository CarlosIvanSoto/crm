"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
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
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { DOCUMENT_TYPES } from "@/components/travel/document-type";
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import { dateInputToIso } from "@/lib/date-input";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";

const NO_CUSTOMER = "none";
const NO_DOCUMENT = "none";

type DocumentType = NonNullable<
	RouterInputs["travelers"]["create"]["documentType"]
>;

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New traveler
		</Button>
	);
}

export function CreateTravelerSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateTravelerForm />
		</Suspense>
	);
}

function CreateTravelerForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useTravelCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [customerId, setCustomerId] = useState(NO_CUSTOMER);
	const [nationality, setNationality] = useState("");
	const [documentType, setDocumentType] = useState<string>(NO_DOCUMENT);
	const [documentNumber, setDocumentNumber] = useState("");
	const [documentExpiresAt, setDocumentExpiresAt] = useState("");

	const firstNameId = useId();
	const lastNameId = useId();
	const nationalityId = useId();
	const documentNumberId = useId();
	const documentExpiresId = useId();

	const customers = useQuery(trpc.customers.options.queryOptions({ q: "" }));

	const create = useMutation(
		trpc.travelers.create.mutationOptions({
			onSuccess: async (traveler) => {
				await cache.traveler(traveler.id);
				toast.success(`${traveler.firstName} ${traveler.lastName} added.`);
				await setOpen(null);
				setFirstName("");
				setLastName("");
				setCustomerId(NO_CUSTOMER);
				setNationality("");
				setDocumentType(NO_DOCUMENT);
				setDocumentNumber("");
				setDocumentExpiresAt("");
				openRecord({ kind: "traveler", id: traveler.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>New traveler</SheetTitle>
					<SheetDescription>
						The person who flies. Link them to a customer to bill the trip.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-traveler"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							firstName,
							lastName,
							customerId: customerId === NO_CUSTOMER ? null : customerId,
							nationality: nationality || null,
							documentType:
								documentType === NO_DOCUMENT
									? null
									: (documentType as DocumentType),
							documentNumber: documentNumber || null,
							documentExpiresAt: dateInputToIso(documentExpiresAt),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={firstNameId}>First name</FieldLabel>
							<Input
								id={firstNameId}
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={lastNameId}>Last name</FieldLabel>
							<Input
								id={lastNameId}
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-traveler-customer">
								Customer
							</FieldLabel>
							<Select value={customerId} onValueChange={setCustomerId}>
								<SelectTrigger id="create-traveler-customer">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_CUSTOMER}>No customer</SelectItem>
									{(customers.data ?? []).map((customer) => (
										<SelectItem key={customer.id} value={customer.id}>
											{customer.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={nationalityId}>Nationality</FieldLabel>
							<Input
								id={nationalityId}
								value={nationality}
								onChange={(event) => setNationality(event.target.value)}
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-traveler-doc-type">
								Document type
							</FieldLabel>
							<Select value={documentType} onValueChange={setDocumentType}>
								<SelectTrigger id="create-traveler-doc-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_DOCUMENT}>None</SelectItem>
									{DOCUMENT_TYPES.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={documentNumberId}>
								Document number
							</FieldLabel>
							<Input
								id={documentNumberId}
								value={documentNumber}
								onChange={(event) => setDocumentNumber(event.target.value)}
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={documentExpiresId}>
								Document expiry
							</FieldLabel>
							<Input
								id={documentExpiresId}
								type="date"
								value={documentExpiresAt}
								onChange={(event) => setDocumentExpiresAt(event.target.value)}
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-traveler"
						disabled={
							create.isPending ||
							firstName.trim() === "" ||
							lastName.trim() === ""
						}
					>
						{create.isPending ? <Spinner /> : null}
						Add traveler
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
