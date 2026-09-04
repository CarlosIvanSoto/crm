import type { ListSearchValues } from "@crm/ui/lib/list-search-params";
import { createListSearchParams } from "@/components/data-table/list-search-params";
import type { RouterInputs } from "@/lib/trpc/types";

export const tasksSearchParams = createListSearchParams({
	defaultSort: "dueAt",
	defaultDir: "asc",
	tabId: "window",
	facetIds: ["assignedTo"] as const,
});

type TaskTab = "window";
type TaskFacet = "assignedTo";

export function toTaskListInput(
	values: ListSearchValues<TaskTab, TaskFacet>,
): RouterInputs["activities"]["tasks"] {
	const {
		fields: _fields,
		archived: _archived,
		window,
		assignedTo,
		...input
	} = tasksSearchParams.toInput(values);

	return {
		...input,
		window: window as RouterInputs["activities"]["tasks"]["window"],
		assignedToId: assignedTo[0] ?? null,
		bookingId: null,
	};
}
