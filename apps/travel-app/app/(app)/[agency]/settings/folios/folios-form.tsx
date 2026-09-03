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
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const YEAR = new Date().getFullYear();

type Draft = { quotePrefix: string; bookingPrefix: string };

export function FoliosForm() {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const quoteId = useId();
	const bookingId = useId();

	const profile = useQuery(trpc.agency.profile.queryOptions());
	const [draft, setDraft] = useState<Draft | null>(null);

	const save = useMutation(
		trpc.agency.updateProfile.mutationOptions({
			onSuccess: async () => {
				await cache.agency();
				setDraft(null);
				toast.success("Folios saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!profile.data) return null;

	const { canManage } = profile.data;
	const saved: Draft = {
		quotePrefix: profile.data.quotePrefix,
		bookingPrefix: profile.data.bookingPrefix,
	};
	const values = draft ?? saved;
	const dirty =
		values.quotePrefix !== saved.quotePrefix ||
		values.bookingPrefix !== saved.bookingPrefix;

	const edit = (patch: Partial<Draft>) => setDraft({ ...values, ...patch });
	const disabled = !canManage || save.isPending;

	const quoteSample = `${values.quotePrefix.trim().toUpperCase() || "COT"}-${YEAR}-0001`;
	const bookingSample = `${values.bookingPrefix.trim().toUpperCase() || "EXP"}-${YEAR}-0001`;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Folio prefixes</CardTitle>
				<CardDescription>
					A prefix, the year and a running count. Changing a prefix does not
					renumber anything issued already.
				</CardDescription>
				<CardAction>
					<Button
						type="submit"
						form="folios"
						disabled={
							disabled ||
							!dirty ||
							values.quotePrefix.trim() === "" ||
							values.bookingPrefix.trim() === ""
						}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="folios"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({
							quotePrefix: values.quotePrefix.trim().toUpperCase(),
							bookingPrefix: values.bookingPrefix.trim().toUpperCase(),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={quoteId}>Quote prefix</FieldLabel>
							<Input
								id={quoteId}
								value={values.quotePrefix}
								onChange={(event) => edit({ quotePrefix: event.target.value })}
								maxLength={8}
								autoCapitalize="characters"
								disabled={disabled}
							/>
							<FieldDescription>Next: {quoteSample}</FieldDescription>
						</Field>

						<Field>
							<FieldLabel htmlFor={bookingId}>Booking prefix</FieldLabel>
							<Input
								id={bookingId}
								value={values.bookingPrefix}
								onChange={(event) =>
									edit({ bookingPrefix: event.target.value })
								}
								maxLength={8}
								autoCapitalize="characters"
								disabled={disabled}
							/>
							<FieldDescription>Next: {bookingSample}</FieldDescription>
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
