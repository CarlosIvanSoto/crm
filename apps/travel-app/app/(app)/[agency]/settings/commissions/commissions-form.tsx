"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
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
import { COMMISSION_BASES } from "@/components/travel/commissions/commission-meta";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const NO_BASIS = "none";

type Draft = { basis: string; ratePercent: string };

function toRatePercent(rate: number | null): string {
	return rate === null ? "" : String(Math.round(rate * 10000) / 100);
}

export function CommissionsForm() {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const rateId = useId();

	const profile = useQuery(trpc.agency.profile.queryOptions());
	const [draft, setDraft] = useState<Draft | null>(null);

	const save = useMutation(
		trpc.agency.updateProfile.mutationOptions({
			onSuccess: async () => {
				await cache.agency();
				setDraft(null);
				toast.success("Commission defaults saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!profile.data) return null;

	const { canManage } = profile.data;
	const saved: Draft = {
		basis: profile.data.defaultCommissionBasis ?? NO_BASIS,
		ratePercent: toRatePercent(profile.data.defaultCommissionRate),
	};
	const values = draft ?? saved;
	const dirty =
		values.basis !== saved.basis || values.ratePercent !== saved.ratePercent;

	const edit = (patch: Partial<Draft>) => setDraft({ ...values, ...patch });
	const disabled = !canManage || save.isPending;

	const rate = Number(values.ratePercent);
	const rateValid =
		values.ratePercent.trim() === "" ||
		(Number.isFinite(rate) && rate >= 0 && rate <= 100);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Default commission</CardTitle>
				<CardDescription>
					A new commission form starts from these. Changing them does not touch
					a commission already created.
				</CardDescription>
				<CardAction>
					<Button
						type="submit"
						form="commission-defaults"
						disabled={disabled || !dirty || !rateValid}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="commission-defaults"
					onSubmit={(event) => {
						event.preventDefault();
						if (!rateValid) return;
						save.mutate({
							defaultCommissionBasis:
								values.basis === NO_BASIS
									? null
									: (values.basis as "MARGIN" | "SELL" | "FIXED"),
							defaultCommissionRate:
								values.ratePercent.trim() === ""
									? null
									: Number(values.ratePercent) / 100,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="commission-default-basis">Basis</FieldLabel>
							<Select
								value={values.basis}
								onValueChange={(next) => edit({ basis: next })}
								disabled={disabled}
							>
								<SelectTrigger id="commission-default-basis">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_BASIS}>Not set</SelectItem>
									{COMMISSION_BASES.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={rateId}>Rate (%)</FieldLabel>
							<Input
								id={rateId}
								inputMode="decimal"
								value={values.ratePercent}
								onChange={(event) => edit({ ratePercent: event.target.value })}
								disabled={disabled}
							/>
							<FieldDescription>
								Used for a margin or sell commission. A fixed one takes an
								amount instead.
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>

				{canManage ? null : (
					<p className="text-muted-foreground text-xs">
						Only an owner or an admin can change this.
					</p>
				)}
			</CardContent>
		</Card>
	);
}
