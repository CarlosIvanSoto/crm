"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { authClient } from "@travel/auth/client";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

export function NewAgencyForm() {
	const nameId = useId();
	const slugId = useId();
	const [name, setName] = useState("");
	const [slugEdit, setSlugEdit] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const slug = useMemo(
		() => (slugEdit === null ? slugify(name) : slugify(slugEdit)),
		[name, slugEdit],
	);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!name || !slug) return;
		setPending(true);

		const created = await authClient.organization.create({ name, slug });
		if (created.error || !created.data) {
			setPending(false);
			toast.error(created.error?.message ?? "Could not create the agency.");
			return;
		}

		await authClient.organization.setActive({
			organizationId: created.data.id,
		});
		window.location.assign(`/${slug}`);
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={submit}>
			<Field>
				<FieldLabel htmlFor={nameId}>Agency name</FieldLabel>
				<Input
					id={nameId}
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Blue Horizon Travel"
					autoComplete="organization"
					required
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={slugId}>URL</FieldLabel>
				<Input
					id={slugId}
					value={slug}
					onChange={(event) => setSlugEdit(event.target.value)}
					placeholder="blue-horizon"
					autoComplete="off"
					required
				/>
				<FieldDescription>
					Your agency lives at /{slug || "your-agency"}. It has to be unique.
				</FieldDescription>
			</Field>
			<Button type="submit" disabled={pending || !name || !slug}>
				{pending ? <Spinner data-icon="inline-start" /> : null}
				Create agency
			</Button>
		</form>
	);
}
