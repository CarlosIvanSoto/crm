import { redirect } from "next/navigation";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function CustomerRedirect({
	params,
}: PageProps<"/[agency]/customers/[customerId]">) {
	const { agency, customerId } = await params;
	redirect(recordHref(agency, "/customers", "customer", customerId));
}
