import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { SignUpForm } from "./sign-up-form";

export const instant = false;

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
	const session = await getSession();
	if (session) redirect("/");

	return (
		<AuthShell>
			<AuthHeading
				title="Create your account"
				description="You set up your agency on the next step."
			/>
			<SignUpForm />
		</AuthShell>
	);
}
