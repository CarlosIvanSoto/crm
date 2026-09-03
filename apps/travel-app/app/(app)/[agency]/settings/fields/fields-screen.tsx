"use client";

import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { FIELD_ENTITIES, type FieldEntityName } from "@travel/db/fields-shape";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { FieldsManager } from "./fields-manager";

const ENTITY_LABEL = {
	CUSTOMER: "Customers",
	TRAVELER: "Travelers",
	QUOTE: "Quotes",
	BOOKING: "Bookings",
	SUPPLIER: "Suppliers",
} satisfies Record<FieldEntityName, string>;

export function FieldsScreen() {
	const [entity, setEntity] = useQueryState(
		"entity",
		parseAsStringLiteral(FIELD_ENTITIES).withDefault("CUSTOMER"),
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<ToggleGroup
				type="single"
				variant="outline"
				size="sm"
				spacing={0}
				value={entity}
				onValueChange={(next) => {
					if ((FIELD_ENTITIES as readonly string[]).includes(next)) {
						void setEntity(next as FieldEntityName);
					}
				}}
				aria-label="Which records to add fields to"
				className="self-start"
			>
				{FIELD_ENTITIES.map((value) => (
					<ToggleGroupItem key={value} value={value}>
						{ENTITY_LABEL[value]}
					</ToggleGroupItem>
				))}
			</ToggleGroup>

			<FieldsManager key={entity} entity={entity} />
		</div>
	);
}
