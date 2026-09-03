import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const customersSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["type", "owner"] as const,
});

type CustomerFacet = "type" | "owner";

export function toCustomerListInput(
	values: ListSearchValues<never, CustomerFacet>,
): RouterInputs["customers"]["list"] {
	const input = customersSearchParams.toInput(values);
	return {
		...input,
		type: input.type as RouterInputs["customers"]["list"]["type"],
	};
}
