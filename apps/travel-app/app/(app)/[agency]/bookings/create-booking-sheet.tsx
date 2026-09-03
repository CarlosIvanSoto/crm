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
import { dateInputToIso } from "@/lib/date-input";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const NO_CUSTOMER = "none";
const NO_OWNER = "unassigned";

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New booking
		</Button>
	);
}

export function CreateBookingSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateBookingForm />
		</Suspense>
	);
}

function CreateBookingForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useTravelCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [customerId, setCustomerId] = useState(NO_CUSTOMER);
	const [ownerId, setOwnerId] = useState(NO_OWNER);
	const [destination, setDestination] = useState("");
	const [currency, setCurrency] = useState("USD");
	const [travelStart, setTravelStart] = useState("");
	const [travelEnd, setTravelEnd] = useState("");

	const destinationId = useId();
	const currencyId = useId();
	const startId = useId();
	const endId = useId();

	const customers = useQuery(trpc.customers.options.queryOptions({ q: "" }));
	const users = useQuery(trpc.users.list.queryOptions());

	const create = useMutation(
		trpc.bookings.create.mutationOptions({
			onSuccess: async (booking) => {
				await cache.booking(booking.id);
				toast.success(`Booking ${booking.folio} created.`);
				await setOpen(null);
				setCustomerId(NO_CUSTOMER);
				setOwnerId(NO_OWNER);
				setDestination("");
				setCurrency("USD");
				setTravelStart("");
				setTravelEnd("");
				openRecord({ kind: "booking", id: booking.id });
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
					<SheetTitle>New booking</SheetTitle>
					<SheetDescription>
						Start a booking by hand. Or accept a quote option instead.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-booking"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (customerId === NO_CUSTOMER) return;
						create.mutate({
							customerId,
							ownerId: ownerId === NO_OWNER ? null : ownerId,
							destination: destination || null,
							currency: currency.trim().toUpperCase() || "USD",
							travelStartDate: dateInputToIso(travelStart),
							travelEndDate: dateInputToIso(travelEnd),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-booking-customer">
								Customer
							</FieldLabel>
							<Select value={customerId} onValueChange={setCustomerId}>
								<SelectTrigger id="create-booking-customer">
									<SelectValue placeholder="Pick a customer" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_CUSTOMER}>Pick a customer</SelectItem>
									{(customers.data ?? []).map((customer) => (
										<SelectItem key={customer.id} value={customer.id}>
											{customer.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-booking-owner">Owner</FieldLabel>
							<Select value={ownerId} onValueChange={setOwnerId}>
								<SelectTrigger id="create-booking-owner">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_OWNER}>Unassigned</SelectItem>
									{(users.data ?? []).map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={destinationId}>Destination</FieldLabel>
							<Input
								id={destinationId}
								value={destination}
								onChange={(event) => setDestination(event.target.value)}
								autoComplete="off"
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
							<FieldLabel htmlFor={startId}>Travel start</FieldLabel>
							<Input
								id={startId}
								type="date"
								value={travelStart}
								onChange={(event) => setTravelStart(event.target.value)}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={endId}>Travel end</FieldLabel>
							<Input
								id={endId}
								type="date"
								value={travelEnd}
								onChange={(event) => setTravelEnd(event.target.value)}
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-booking"
						disabled={create.isPending || customerId === NO_CUSTOMER}
					>
						{create.isPending ? <Spinner /> : null}
						Create booking
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
