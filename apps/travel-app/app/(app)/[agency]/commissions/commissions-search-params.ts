import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const commissionsSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["status", "basis"] as const,
});

type CommissionFacet = "status" | "basis";

export function toCommissionListInput(
	values: ListSearchValues<never, CommissionFacet>,
): RouterInputs["commissions"]["list"] {
	const {
		fields: _fields,
		archived: _archived,
		...input
	} = commissionsSearchParams.toInput(values);
	return {
		...input,
		status: input.status as RouterInputs["commissions"]["list"]["status"],
		basis: input.basis as RouterInputs["commissions"]["list"]["basis"],
	};
}
