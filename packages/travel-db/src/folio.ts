import type { Prisma } from "./generated/prisma/client";

export const COUNTER_KIND = {
	quote: "QUOTE",
	booking: "BOOKING",
} as const;

export type CounterKind = (typeof COUNTER_KIND)[keyof typeof COUNTER_KIND];

export async function nextCounter(
	tx: Prisma.TransactionClient,
	agencyId: string,
	kind: CounterKind,
): Promise<number> {
	const rows = await tx.$queryRaw<Array<{ value: number }>>`
		INSERT INTO "agencyCounter" ("agencyId", "kind", "value", "updatedAt")
		VALUES (${agencyId}, ${kind}, 1, now())
		ON CONFLICT ("agencyId", "kind")
		DO UPDATE SET "value" = "agencyCounter"."value" + 1, "updatedAt" = now()
		RETURNING "value"
	`;

	const first = rows[0];
	if (!first) {
		throw new Error(
			`Could not allocate a ${kind} folio for agency ${agencyId}.`,
		);
	}

	return first.value;
}

export function formatFolio(
	prefix: string,
	year: number,
	value: number,
): string {
	return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}
