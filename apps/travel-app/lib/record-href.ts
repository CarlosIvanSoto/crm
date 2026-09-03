import { agencyUrl } from "@/lib/agency-url";

type RecordList =
	| "/customers"
	| "/travelers"
	| "/suppliers"
	| "/quotes"
	| "/bookings";

type RecordKind = "customer" | "traveler" | "supplier" | "quote" | "booking";

export function recordHref(
	slug: string,
	list: RecordList,
	kind: RecordKind,
	id: string,
): string {
	const query = new URLSearchParams({ record: `${kind}:${id}` });

	return `${agencyUrl(slug, list)}?${query}`;
}
