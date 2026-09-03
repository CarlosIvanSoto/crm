import { redirect } from "next/navigation";

export const instant = false;

export default function LandingIndex() {
	redirect("/sign-in");
}
