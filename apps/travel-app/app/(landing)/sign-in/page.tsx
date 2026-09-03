import { isGoogleConfigured } from "@travel/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
	const session = await getSession();
	if (session) redirect("/");

	return (
		<AuthShell>
			<AuthHeading
				title="Welcome back"
				description="Sign in with your agency account to continue."
			/>
			<SignInForm googleEnabled={isGoogleConfigured()} />
		</AuthShell>
	);
}
