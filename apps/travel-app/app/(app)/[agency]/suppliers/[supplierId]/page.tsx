import { redirect } from "next/navigation";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function SupplierRedirect({
	params,
}: PageProps<"/[agency]/suppliers/[supplierId]">) {
	const { agency, supplierId } = await params;
	redirect(recordHref(agency, "/suppliers", "supplier", supplierId));
}
