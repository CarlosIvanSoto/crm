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
import { COMMISSION_BASES } from "@/components/travel/commissions/commission-meta";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";

type Basis = RouterInputs["commissions"]["create"]["basis"];

const NO_BOOKING = "none";
const NO_ADVISOR = "none";

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New commission
		</Button>
	);
}

export function CreateCommissionSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateCommissionForm />
		</Suspense>
	);
}

function CreateCommissionForm() {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [bookingId, setBookingId] = useState(NO_BOOKING);
	const [advisorId, setAdvisorId] = useState(NO_ADVISOR);
	const [basis, setBasis] = useState<Basis>("MARGIN");
	const [ratePercent, setRatePercent] = useState("");
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("USD");
	const [note, setNote] = useState("");

	const rateId = useId();
	const amountId = useId();
	const currencyId = useId();
	const noteId = useId();

	const bookings = useQuery(
		trpc.bookings.list.queryOptions({
			sort: "createdAt",
			dir: "desc",
			pageSize: 50,
		}),
	);
	const advisors = useQuery(trpc.users.list.queryOptions());

	const reset = () => {
		setBookingId(NO_BOOKING);
		setAdvisorId(NO_ADVISOR);
		setBasis("MARGIN");
		setRatePercent("");
		setAmount("");
		setCurrency("USD");
		setNote("");
	};

	const create = useMutation(
		trpc.commissions.create.mutationOptions({
			onSuccess: async () => {
				await cache.commission();
				toast.success("Commission created.");
				await setOpen(null);
				reset();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const isFixed = basis === "FIXED";
	const rate = Number(ratePercent);
	const numericAmount = Number(amount);
	const valid =
		bookingId !== NO_BOOKING &&
		advisorId !== NO_ADVISOR &&
		(isFixed
			? Number.isFinite(numericAmount) &&
				numericAmount > 0 &&
				currency.trim().length === 3
			: Number.isFinite(rate) && rate > 0 && rate <= 100);

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>New commission</SheetTitle>
					<SheetDescription>
						The advisor's cut of one booking. The amount is frozen when you
						create it.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-commission"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!valid) return;
						create.mutate({
							bookingId,
							userId: advisorId,
							basis,
							rate: isFixed ? null : rate / 100,
							amount: isFixed ? numericAmount : null,
							currency: isFixed ? currency.trim().toUpperCase() : null,
							note: note.trim() || null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-commission-booking">
								Booking
							</FieldLabel>
							<Select value={bookingId} onValueChange={setBookingId}>
								<SelectTrigger id="create-commission-booking">
									<SelectValue placeholder="Pick a booking" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_BOOKING}>Pick a booking</SelectItem>
									{(bookings.data?.rows ?? []).map((booking) => (
										<SelectItem key={booking.id} value={booking.id}>
											{booking.folio} · {booking.customer.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-commission-advisor">
								Advisor
							</FieldLabel>
							<Select value={advisorId} onValueChange={setAdvisorId}>
								<SelectTrigger id="create-commission-advisor">
									<SelectValue placeholder="Pick an advisor" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_ADVISOR}>Pick an advisor</SelectItem>
									{(advisors.data ?? []).map((advisor) => (
										<SelectItem key={advisor.id} value={advisor.id}>
											{advisor.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-commission-basis">Basis</FieldLabel>
							<Select
								value={basis}
								onValueChange={(next) => setBasis(next as Basis)}
							>
								<SelectTrigger id="create-commission-basis">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COMMISSION_BASES.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						{isFixed ? (
							<>
								<Field>
									<FieldLabel htmlFor={amountId}>Amount</FieldLabel>
									<Input
										id={amountId}
										inputMode="decimal"
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
							</>
						) : (
							<Field>
								<FieldLabel htmlFor={rateId}>Rate (%)</FieldLabel>
								<Input
									id={rateId}
									inputMode="decimal"
									value={ratePercent}
									onChange={(event) => setRatePercent(event.target.value)}
								/>
							</Field>
						)}

						<Field>
							<FieldLabel htmlFor={noteId}>Note</FieldLabel>
							<Input
								id={noteId}
								value={note}
								onChange={(event) => setNote(event.target.value)}
								autoComplete="off"
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-commission"
						disabled={create.isPending || !valid}
					>
						{create.isPending ? <Spinner /> : null}
						Create commission
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
