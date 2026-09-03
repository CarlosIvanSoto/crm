import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const travelersSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["customer", "documentType"] as const,
});

type TravelerFacet = "customer" | "documentType";

export function toTravelerListInput(
	values: ListSearchValues<never, TravelerFacet>,
): RouterInputs["travelers"]["list"] {
	const input = travelersSearchParams.toInput(values);
	return {
		...input,
		documentType:
			input.documentType as RouterInputs["travelers"]["list"]["documentType"],
	};
}
