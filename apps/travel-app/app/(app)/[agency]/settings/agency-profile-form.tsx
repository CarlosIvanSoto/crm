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
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type Draft = {
	legalName: string;
	taxId: string;
	taxRegime: string;
	phone: string;
	email: string;
	timezone: string;
	logoUrl: string;
	defaultTerms: string;
};

function draftFrom(profile: {
	legalName: string | null;
	taxId: string | null;
	taxRegime: string | null;
	phone: string | null;
	email: string | null;
	timezone: string;
	logoUrl: string | null;
	defaultTerms: string | null;
}): Draft {
	return {
		legalName: profile.legalName ?? "",
		taxId: profile.taxId ?? "",
		taxRegime: profile.taxRegime ?? "",
		phone: profile.phone ?? "",
		email: profile.email ?? "",
		timezone: profile.timezone,
		logoUrl: profile.logoUrl ?? "",
		defaultTerms: profile.defaultTerms ?? "",
	};
}

export function AgencyProfileForm() {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const legalNameId = useId();
	const taxIdId = useId();
	const taxRegimeId = useId();
	const phoneId = useId();
	const emailId = useId();
	const timezoneId = useId();
	const logoUrlId = useId();
	const termsId = useId();

	const profile = useQuery(trpc.agency.profile.queryOptions());
	const [draft, setDraft] = useState<Draft | null>(null);

	const save = useMutation(
		trpc.agency.updateProfile.mutationOptions({
			onSuccess: async () => {
				await cache.agency();
				setDraft(null);
				toast.success("Agency saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!profile.data) return null;

	const { canManage } = profile.data;
	const values = draft ?? draftFrom(profile.data);
	const saved = draftFrom(profile.data);
	const dirty = (Object.keys(values) as (keyof Draft)[]).some(
		(key) => values[key] !== saved[key],
	);

	const edit = (patch: Partial<Draft>) => setDraft({ ...values, ...patch });

	const disabled = !canManage || save.isPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Agency</CardTitle>
				<CardDescription>
					These details print on quotes and vouchers.
				</CardDescription>
				<CardAction>
					<Button
						type="submit"
						form="agency-profile"
						disabled={disabled || !dirty}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="agency-profile"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({
							legalName: values.legalName.trim() || null,
							taxId: values.taxId.trim() || null,
							taxRegime: values.taxRegime.trim() || null,
							phone: values.phone.trim() || null,
							email: values.email.trim() || null,
							timezone: values.timezone.trim(),
							logoUrl: values.logoUrl.trim() || null,
							defaultTerms: values.defaultTerms.trim() || null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={legalNameId}>Legal name</FieldLabel>
							<Input
								id={legalNameId}
								value={values.legalName}
								onChange={(event) => edit({ legalName: event.target.value })}
								disabled={disabled}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={taxIdId}>Tax ID</FieldLabel>
							<Input
								id={taxIdId}
								value={values.taxId}
								onChange={(event) => edit({ taxId: event.target.value })}
								disabled={disabled}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={taxRegimeId}>Tax regime</FieldLabel>
							<Input
								id={taxRegimeId}
								value={values.taxRegime}
								onChange={(event) => edit({ taxRegime: event.target.value })}
								disabled={disabled}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={phoneId}>Phone</FieldLabel>
							<Input
								id={phoneId}
								value={values.phone}
								onChange={(event) => edit({ phone: event.target.value })}
								inputMode="tel"
								disabled={disabled}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={emailId}>Email</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={values.email}
								onChange={(event) => edit({ email: event.target.value })}
								disabled={disabled}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={timezoneId}>Time zone</FieldLabel>
							<Input
								id={timezoneId}
								value={values.timezone}
								onChange={(event) => edit({ timezone: event.target.value })}
								placeholder="America/Mexico_City"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={disabled}
							/>
							<FieldDescription>
								An IANA name, like America/Mexico_City or Europe/Madrid.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel htmlFor={logoUrlId}>Logo URL</FieldLabel>
							<Input
								id={logoUrlId}
								value={values.logoUrl}
								onChange={(event) => edit({ logoUrl: event.target.value })}
								inputMode="url"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								placeholder="https://…"
								disabled={disabled}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={termsId}>Default terms</FieldLabel>
							<Textarea
								id={termsId}
								rows={4}
								value={values.defaultTerms}
								onChange={(event) => edit({ defaultTerms: event.target.value })}
								disabled={disabled}
							/>
							<FieldDescription>
								Copied onto a new quote. Each quote can override it.
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
