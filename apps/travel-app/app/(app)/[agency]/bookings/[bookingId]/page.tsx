import { redirect } from "next/navigation";
import { recordHref } from "@/lib/record-href";

export const instant = false;

export default async function BookingRedirect({
	params,
}: PageProps<"/[agency]/bookings/[bookingId]">) {
	const { agency, bookingId } = await params;
	redirect(recordHref(agency, "/bookings", "booking", bookingId));
}
