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
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";

const UNASSIGNED = "unassigned";

type CustomerType = RouterInputs["customers"]["create"]["type"];

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New customer
		</Button>
	);
}

export function CreateCustomerSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateCustomerForm />
		</Suspense>
	);
}

function CreateCustomerForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useTravelCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [type, setType] = useState<CustomerType>("PERSON");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [ownerId, setOwnerId] = useState(UNASSIGNED);

	const nameId = useId();
	const emailId = useId();
	const phoneId = useId();

	const users = useQuery(trpc.users.list.queryOptions());

	const create = useMutation(
		trpc.customers.create.mutationOptions({
			onSuccess: async (customer) => {
				await cache.customer(customer.id);
				toast.success(`${customer.name} added.`);
				await setOpen(null);
				setName("");
				setEmail("");
				setPhone("");
				setType("PERSON");
				setOwnerId(UNASSIGNED);
				openRecord({ kind: "customer", id: customer.id });
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
					<SheetTitle>New customer</SheetTitle>
					<SheetDescription>
						A person or a company. You add travelers and quotes afterward.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-customer"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							type,
							name,
							email: email || null,
							phone: phone || null,
							ownerId: ownerId === UNASSIGNED ? null : ownerId,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-customer-type">Type</FieldLabel>
							<Select
								value={type}
								onValueChange={(value) => setType(value as CustomerType)}
							>
								<SelectTrigger id="create-customer-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="PERSON">Person</SelectItem>
									<SelectItem value="COMPANY">Company</SelectItem>
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
							<FieldLabel htmlFor="create-customer-owner">Owner</FieldLabel>
							<Select value={ownerId} onValueChange={setOwnerId}>
								<SelectTrigger id="create-customer-owner">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
									{(users.data ?? []).map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-customer"
						disabled={create.isPending || name.trim() === ""}
					>
						{create.isPending ? <Spinner /> : null}
						Add customer
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
