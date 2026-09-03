import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const quotesSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["status", "owner"] as const,
});

type QuoteFacet = "status" | "owner";

export function toQuoteListInput(
	values: ListSearchValues<never, QuoteFacet>,
): RouterInputs["quotes"]["list"] {
	const input = quotesSearchParams.toInput(values);
	return {
		...input,
		status: input.status as RouterInputs["quotes"]["list"]["status"],
	};
}
