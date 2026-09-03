import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const suppliersSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["kind"] as const,
});

type SupplierFacet = "kind";

export function toSupplierListInput(
	values: ListSearchValues<never, SupplierFacet>,
): RouterInputs["suppliers"]["list"] {
	const input = suppliersSearchParams.toInput(values);
	return {
		...input,
		kind: input.kind as RouterInputs["suppliers"]["list"]["kind"],
	};
}
