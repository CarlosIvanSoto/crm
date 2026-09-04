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
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";
import { COMMISSION_BASES } from "./commission-meta";

type Basis = RouterInputs["commissions"]["create"]["basis"];

const NO_ADVISOR = "none";

export function AddCommissionDialog({
	bookingId,
	open,
	onOpenChange,
}: {
	bookingId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const rateId = useId();
	const amountId = useId();
	const currencyId = useId();
	const noteId = useId();

	const [advisorId, setAdvisorId] = useState(NO_ADVISOR);
	const [basis, setBasis] = useState<Basis>("MARGIN");
	const [ratePercent, setRatePercent] = useState("");
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("USD");
	const [note, setNote] = useState("");

	const advisors = useQuery(trpc.users.list.queryOptions());

	const add = useMutation(
		trpc.commissions.create.mutationOptions({
			onSuccess: async () => {
				await cache.commission(bookingId);
				toast.success("Commission created.");
				onOpenChange(false);
				setAdvisorId(NO_ADVISOR);
				setBasis("MARGIN");
				setRatePercent("");
				setAmount("");
				setNote("");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const isFixed = basis === "FIXED";
	const rate = Number(ratePercent);
	const numericAmount = Number(amount);
	const valid =
		advisorId !== NO_ADVISOR &&
		(isFixed
			? Number.isFinite(numericAmount) &&
				numericAmount > 0 &&
				currency.trim().length === 3
			: Number.isFinite(rate) && rate > 0 && rate <= 100);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a commission</DialogTitle>
					<DialogDescription>
						The advisor's cut of this booking. The amount is frozen now.
					</DialogDescription>
				</DialogHeader>

				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="add-commission-advisor">Advisor</FieldLabel>
						<Select value={advisorId} onValueChange={setAdvisorId}>
							<SelectTrigger id="add-commission-advisor">
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
						<FieldLabel htmlFor="add-commission-basis">Basis</FieldLabel>
						<Select
							value={basis}
							onValueChange={(next) => setBasis(next as Basis)}
						>
							<SelectTrigger id="add-commission-basis">
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
						</>
					) : (
						<Field>
							<FieldLabel htmlFor={rateId}>Rate (%)</FieldLabel>
							<Input
								id={rateId}
								type="number"
								min={0}
								step="0.01"
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
						/>
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button
						disabled={!valid || add.isPending}
						onClick={() => {
							if (!valid) return;
							add.mutate({
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
						{add.isPending ? <Spinner /> : null}
						Add commission
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
