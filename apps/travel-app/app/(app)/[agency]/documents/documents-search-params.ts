import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const documentsSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["kind"] as const,
});

type DocumentFacet = "kind";

export function toDocumentListInput(
	values: ListSearchValues<never, DocumentFacet>,
): RouterInputs["documents"]["list"] {
	const {
		fields: _fields,
		archived: _archived,
		...input
	} = documentsSearchParams.toInput(values);
	return {
		...input,
		kind: input.kind as RouterInputs["documents"]["list"]["kind"],
	};
}
