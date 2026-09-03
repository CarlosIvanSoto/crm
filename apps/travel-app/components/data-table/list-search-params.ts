import {
	createListSearchParams as create,
	type ListSearchParams,
	type ListTableConfig,
} from "@crm/ui/lib/list-search-params";
import { RESERVED_SEARCH_PARAM_KEYS } from "@/lib/search-param-keys";

export function createListSearchParams<
	TTab extends string = never,
	TFacet extends string = never,
>(config: ListTableConfig<TTab, TFacet> = {}): ListSearchParams<TTab, TFacet> {
	return create<TTab, TFacet>({
		...config,
		reserved: RESERVED_SEARCH_PARAM_KEYS,
	});
}
