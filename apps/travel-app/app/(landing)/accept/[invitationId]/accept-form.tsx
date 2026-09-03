"use client";

import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { authClient } from "@travel/auth/client";
import { useState } from "react";
import { toast } from "sonner";

export function AcceptForm({ invitationId }: { invitationId: string }) {
	const [pending, setPending] = useState(false);

	async function accept() {
		setPending(true);
		const result = await authClient.organization.acceptInvitation({
			invitationId,
		});
		if (result.error || !result.data) {
			setPending(false);
			toast.error(result.error?.message ?? "Could not accept the invitation.");
			return;
		}

		await authClient.organization.setActive({
			organizationId: result.data.invitation.organizationId,
		});
		window.location.assign("/");
	}

	return (
		<Button
			type="button"
			disabled={pending}
			onClick={() => {
				accept().catch(() => setPending(false));
			}}
		>
			{pending ? <Spinner data-icon="inline-start" /> : null}
			Accept invitation
		</Button>
	);
}
