import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireSession } from "@/lib/session";
import { NewAgencyForm } from "./new-agency-form";

export const instant = false;

export const metadata: Metadata = { title: "Create your agency" };

export default async function NewAgencyPage() {
	await requireSession();

	return (
		<AuthShell>
			<AuthHeading
				title="Create your agency"
				description="This is the workspace your team shares."
			/>
			<NewAgencyForm />
		</AuthShell>
	);
}
