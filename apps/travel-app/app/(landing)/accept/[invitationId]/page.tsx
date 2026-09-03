import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { AcceptForm } from "./accept-form";

export const instant = false;

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptPage({
	params,
}: PageProps<"/accept/[invitationId]">) {
	const { invitationId } = await params;
	const session = await getSession();

	if (!session) {
		redirect(`/sign-in?next=${encodeURIComponent(`/accept/${invitationId}`)}`);
	}

	return (
		<AuthShell>
			<AuthHeading
				title="Join the agency"
				description="Accept the invitation to get access."
			/>
			<AcceptForm invitationId={invitationId} />
		</AuthShell>
	);
}
