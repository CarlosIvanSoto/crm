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
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import { SUPPLIER_KINDS } from "@/components/travel/supplier-kind";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";

type SupplierKind = RouterInputs["suppliers"]["create"]["kind"];

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New supplier
		</Button>
	);
}

export function CreateSupplierSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateSupplierForm />
		</Suspense>
	);
}

function CreateSupplierForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useTravelCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [kind, setKind] = useState<SupplierKind>("OTHER");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [currency, setCurrency] = useState("");
	const [notes, setNotes] = useState("");

	const nameId = useId();
	const emailId = useId();
	const phoneId = useId();
	const currencyId = useId();
	const notesId = useId();

	const create = useMutation(
		trpc.suppliers.create.mutationOptions({
			onSuccess: async (supplier) => {
				await cache.supplier(supplier.id);
				toast.success(`${supplier.name} added.`);
				await setOpen(null);
				setName("");
				setEmail("");
				setPhone("");
				setCurrency("");
				setNotes("");
				setKind("OTHER");
				openRecord({ kind: "supplier", id: supplier.id });
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
					<SheetTitle>New supplier</SheetTitle>
					<SheetDescription>
						A wholesaler, hotel, airline or operator you buy from.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-supplier"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						const code = currency.trim().toUpperCase();
						create.mutate({
							kind,
							name,
							email: email || null,
							phone: phone || null,
							defaultCurrency: code.length === 3 ? code : null,
							notes: notes || null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-supplier-kind">Kind</FieldLabel>
							<Select
								value={kind}
								onValueChange={(value) => setKind(value as SupplierKind)}
							>
								<SelectTrigger id="create-supplier-kind">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SUPPLIER_KINDS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={emailId}>Email</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={phoneId}>Phone</FieldLabel>
							<Input
								id={phoneId}
								value={phone}
								onChange={(event) => setPhone(event.target.value)}
								autoComplete="off"
								inputMode="tel"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={currencyId}>Default currency</FieldLabel>
							<Input
								id={currencyId}
								value={currency}
								onChange={(event) => setCurrency(event.target.value)}
								autoComplete="off"
								maxLength={3}
								placeholder="USD"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={notesId}>Notes</FieldLabel>
							<Textarea
								id={notesId}
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								rows={3}
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-supplier"
						disabled={create.isPending || name.trim() === ""}
					>
						{create.isPending ? <Spinner /> : null}
						Add supplier
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
