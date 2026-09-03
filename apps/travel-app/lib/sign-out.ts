import { signOut } from "@travel/auth/client";

export async function signOutAndRedirect(): Promise<void> {
	await signOut();
	window.location.assign("/sign-in");
}
