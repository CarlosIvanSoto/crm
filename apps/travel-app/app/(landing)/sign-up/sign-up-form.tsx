"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { signUp } from "@travel/auth/client";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";

export function SignUpForm() {
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setPending(true);
		const { error } = await signUp.email({
			name,
			email,
			password,
			callbackURL: "/new-agency",
		});
		if (error) {
			setPending(false);
			toast.error(error.message ?? "Could not create the account.");
			return;
		}
		window.location.assign("/new-agency");
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={submit}>
			<Field>
				<FieldLabel htmlFor={nameId}>Name</FieldLabel>
				<Input
					id={nameId}
					value={name}
					onChange={(event) => setName(event.target.value)}
					autoComplete="name"
					required
				/>
			</Field>
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
					autoComplete="new-password"
					minLength={8}
					required
				/>
			</Field>
			<Button
				type="submit"
				disabled={pending || name === "" || email === "" || password.length < 8}
			>
				{pending ? <Spinner data-icon="inline-start" /> : null}
				Create account
			</Button>
			<p className="text-center text-muted-foreground text-sm/5">
				Already have an account?{" "}
				<Link
					href="/sign-in"
					className="underline underline-offset-4 hover:text-foreground"
				>
					Sign in
				</Link>
			</p>
		</form>
	);
}
