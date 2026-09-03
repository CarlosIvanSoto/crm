import type { RecordKind } from "@/components/travel/record-sheet/record-stack";

export type FieldEntity =
	| "CUSTOMER"
	| "TRAVELER"
	| "QUOTE"
	| "BOOKING"
	| "SUPPLIER";

const TO_ENTITY = {
	customer: "CUSTOMER",
	traveler: "TRAVELER",
	quote: "QUOTE",
	booking: "BOOKING",
	supplier: "SUPPLIER",
} satisfies Record<RecordKind, FieldEntity>;

const TO_KIND = {
	CUSTOMER: "customer",
	TRAVELER: "traveler",
	QUOTE: "quote",
	BOOKING: "booking",
	SUPPLIER: "supplier",
} satisfies Record<FieldEntity, RecordKind>;

export function entityOf(kind: RecordKind): FieldEntity {
	return TO_ENTITY[kind];
}

export function kindOf(entity: FieldEntity): RecordKind {
	return TO_KIND[entity];
}
