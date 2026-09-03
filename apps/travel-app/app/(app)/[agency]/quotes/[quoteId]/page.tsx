import { redirect } from "next/navigation";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function QuoteRedirect({
	params,
}: PageProps<"/[agency]/quotes/[quoteId]">) {
	const { agency, quoteId } = await params;
	redirect(recordHref(agency, "/quotes", "quote", quoteId));
}
