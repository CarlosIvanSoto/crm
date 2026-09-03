import { redirect } from "next/navigation";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function TravelerRedirect({
	params,
}: PageProps<"/[agency]/travelers/[travelerId]">) {
	const { agency, travelerId } = await params;
	redirect(recordHref(agency, "/travelers", "traveler", travelerId));
}
