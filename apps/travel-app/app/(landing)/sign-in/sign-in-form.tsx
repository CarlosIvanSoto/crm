"use client";

import GoogleLogo from "@crm/ui/components/brand-logos/google";
import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Separator } from "@crm/ui/components/separator";
import { Spinner } from "@crm/ui/components/spinner";
import { signIn } from "@travel/auth/client";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
	const emailId = useId();
	const passwordId = useId();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setPending(true);
		const { error } = await signIn.email({
			email,
			password,
			callbackURL: "/",
		});
		if (error) {
			setPending(false);
			toast.error(error.message ?? "Could not sign in.");
			return;
		}
		window.location.assign("/");
	}

	async function google() {
		setPending(true);
		const origin = window.location.origin;
		const { error } = await signIn.social({
			provider: "google",
			callbackURL: `${origin}/`,
			errorCallbackURL: `${origin}/sign-in`,
		});
		if (error) {
			setPending(false);
			toast.error(error.message ?? "Could not reach Google.");
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<form className="flex flex-col gap-4" onSubmit={submit}>
				<Field>
					<FieldLabel htmlFor={emailId}>Email</FieldLabel>
					<Input
						id={emailId}
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						autoComplete="email"
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={passwordId}>Password</FieldLabel>
					<Input
						id={passwordId}
						type="password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						autoComplete="current-password"
						required
					/>
				</Field>
				<Button
					type="submit"
					disabled={pending || email === "" || password === ""}
				>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					Sign in
				</Button>
			</form>

			{googleEnabled ? (
				<>
					<Separator />
					<Button
						type="button"
						variant="outline"
						disabled={pending}
						onClick={() => {
							google().catch(() => setPending(false));
						}}
					>
						<GoogleLogo data-icon="inline-start" className="size-4" />
						Continue with Google
					</Button>
				</>
			) : null}

			<p className="text-center text-muted-foreground text-sm/5">
				New here?{" "}
				<Link
					href="/sign-up"
					className="underline underline-offset-4 hover:text-foreground"
				>
					Create an account
				</Link>
			</p>
		</div>
	);
}
