import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const bookingsSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["status", "owner"] as const,
});

type BookingFacet = "status" | "owner";

export function toBookingListInput(
	values: ListSearchValues<never, BookingFacet>,
): RouterInputs["bookings"]["list"] {
	const input = bookingsSearchParams.toInput(values);
	return {
		...input,
		status: input.status as RouterInputs["bookings"]["list"]["status"],
	};
}
