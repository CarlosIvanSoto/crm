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
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { dateInputToIso } from "@/lib/date-input";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";
import { PAYMENT_METHODS } from "./payment-meta";

const NO_METHOD = "none";
const NO_SUPPLIER = "none";

type BaseProps = {
	bookingId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function AddPaymentDialog({ bookingId, open, onOpenChange }: BaseProps) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const amountId = useId();
	const currencyId = useId();
	const dueId = useId();
	const referenceId = useId();

	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("USD");
	const [dueDate, setDueDate] = useState("");
	const [method, setMethod] = useState(NO_METHOD);
	const [reference, setReference] = useState("");

	const add = useMutation(
		trpc.payments.add.mutationOptions({
			onSuccess: async () => {
				await cache.payment(bookingId);
				toast.success("Charge scheduled.");
				onOpenChange(false);
				setAmount("");
				setReference("");
				setDueDate("");
				setMethod(NO_METHOD);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const iso = dateInputToIso(dueDate);
	const numeric = Number(amount);
	const valid =
		iso !== null &&
		Number.isFinite(numeric) &&
		numeric > 0 &&
		currency.trim().length === 3;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Schedule a charge</DialogTitle>
					<DialogDescription>
						What the customer owes for this booking.
					</DialogDescription>
				</DialogHeader>

				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={amountId}>Amount</FieldLabel>
						<Input
							id={amountId}
							type="number"
							min={0}
							step="0.01"
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={currencyId}>Currency</FieldLabel>
						<Input
							id={currencyId}
							maxLength={3}
							value={currency}
							onChange={(event) =>
								setCurrency(event.target.value.toUpperCase())
							}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={dueId}>Due date</FieldLabel>
						<Input
							id={dueId}
							type="date"
							value={dueDate}
							onChange={(event) => setDueDate(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="add-payment-method">Method</FieldLabel>
						<Select value={method} onValueChange={setMethod}>
							<SelectTrigger id="add-payment-method">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_METHOD}>Not set</SelectItem>
								{PAYMENT_METHODS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={referenceId}>Reference</FieldLabel>
						<Input
							id={referenceId}
							value={reference}
							onChange={(event) => setReference(event.target.value)}
						/>
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button
						disabled={!valid || add.isPending}
						onClick={() => {
							if (!iso) return;
							add.mutate({
								bookingId,
								amount: numeric,
								currency: currency.trim().toUpperCase(),
								dueDate: iso,
								method:
									method === NO_METHOD
										? null
										: (method as RouterInputs["payments"]["add"]["method"]),
								reference: reference || null,
							});
						}}
					>
						{add.isPending ? <Spinner /> : null}
						Schedule
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function AddPayableDialog({ bookingId, open, onOpenChange }: BaseProps) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const amountId = useId();
	const currencyId = useId();
	const dueId = useId();
	const referenceId = useId();

	const [supplierId, setSupplierId] = useState(NO_SUPPLIER);
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("USD");
	const [dueDate, setDueDate] = useState("");
	const [method, setMethod] = useState(NO_METHOD);
	const [reference, setReference] = useState("");

	const suppliers = useQuery(trpc.suppliers.options.queryOptions({ q: "" }));

	const add = useMutation(
		trpc.payments.addPayable.mutationOptions({
			onSuccess: async () => {
				await cache.payment(bookingId);
				toast.success("Payable scheduled.");
				onOpenChange(false);
				setAmount("");
				setReference("");
				setDueDate("");
				setMethod(NO_METHOD);
				setSupplierId(NO_SUPPLIER);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const iso = dateInputToIso(dueDate);
	const numeric = Number(amount);
	const valid =
		iso !== null &&
		supplierId !== NO_SUPPLIER &&
		Number.isFinite(numeric) &&
		numeric > 0 &&
		currency.trim().length === 3;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Schedule a payable</DialogTitle>
					<DialogDescription>
						What the agency owes a supplier for this booking.
					</DialogDescription>
				</DialogHeader>

				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="add-payable-supplier">Supplier</FieldLabel>
						<Select value={supplierId} onValueChange={setSupplierId}>
							<SelectTrigger id="add-payable-supplier">
								<SelectValue placeholder="Pick a supplier" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_SUPPLIER}>Pick a supplier</SelectItem>
								{(suppliers.data ?? []).map((supplier) => (
									<SelectItem key={supplier.id} value={supplier.id}>
										{supplier.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={amountId}>Amount</FieldLabel>
						<Input
							id={amountId}
							type="number"
							min={0}
							step="0.01"
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={currencyId}>Currency</FieldLabel>
						<Input
							id={currencyId}
							maxLength={3}
							value={currency}
							onChange={(event) =>
								setCurrency(event.target.value.toUpperCase())
							}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={dueId}>Due date</FieldLabel>
						<Input
							id={dueId}
							type="date"
							value={dueDate}
							onChange={(event) => setDueDate(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="add-payable-method">Method</FieldLabel>
						<Select value={method} onValueChange={setMethod}>
							<SelectTrigger id="add-payable-method">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_METHOD}>Not set</SelectItem>
								{PAYMENT_METHODS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={referenceId}>Reference</FieldLabel>
						<Input
							id={referenceId}
							value={reference}
							onChange={(event) => setReference(event.target.value)}
						/>
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button
						disabled={!valid || add.isPending}
						onClick={() => {
							if (!iso || supplierId === NO_SUPPLIER) return;
							add.mutate({
								bookingId,
								supplierId,
								bookingItemId: null,
								amount: numeric,
								currency: currency.trim().toUpperCase(),
								dueDate: iso,
								method:
									method === NO_METHOD
										? null
										: (method as RouterInputs["payments"]["add"]["method"]),
								reference: reference || null,
							});
						}}
					>
						{add.isPending ? <Spinner /> : null}
						Schedule
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
