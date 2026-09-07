import type { Db } from "./client";

export const TENANT_MODELS = [
	"AgencySettings",
	"AgencyCounter",
	"Customer",
	"Traveler",
	"TravelerLoyalty",
	"Supplier",
	"Quote",
	"QuoteOption",
	"QuoteItem",
	"QuoteShare",
	"Booking",
	"BookingTraveler",
	"BookingItem",
	"Payment",
	"SupplierPayment",
	"Commission",
	"Document",
	"Activity",
	"AgentTask",
	"AgentConversation",
	"FieldDefinition",
	"FieldOption",
	"FieldValue",
	"SavedView",
] as const;

const TENANT_MODEL_SET: ReadonlySet<string> = new Set(TENANT_MODELS);

const SCOPED_WHERE_OPS: ReadonlySet<string> = new Set([
	"findFirst",
	"findFirstOrThrow",
	"findMany",
	"count",
	"aggregate",
	"groupBy",
	"update",
	"updateMany",
	"delete",
	"deleteMany",
	"upsert",
]);

const FORCED_DATA_OPS: ReadonlySet<string> = new Set([
	"create",
	"createMany",
	"update",
	"updateMany",
]);

export function agencyDb(client: Db, agencyId: string) {
	return client.$extends({
		name: "agency-scope",
		query: {
			$allModels: {
				$allOperations({ model, operation, args, query }) {
					if (!TENANT_MODEL_SET.has(model)) {
						return query(args);
					}

					if (operation === "findUnique" || operation === "findUniqueOrThrow") {
						throw new Error(
							`${model}.${operation} cannot be tenant-scoped. Read with findFirst({ where: { id, agencyId } }).`,
						);
					}

					const next: Record<string, unknown> = { ...args };

					if (SCOPED_WHERE_OPS.has(operation)) {
						const where = next.where as Record<string, unknown> | undefined;
						next.where = { ...where, agencyId };
					}

					if (FORCED_DATA_OPS.has(operation)) {
						next.data = pinAgencyId(next.data, agencyId);
					}

					if (operation === "upsert") {
						next.create = pinAgencyId(next.create, agencyId);
						next.update = pinAgencyId(next.update, agencyId);
					}

					return query(next);
				},
			},
		},
	});
}

function pinAgencyId(data: unknown, agencyId: string): unknown {
	if (Array.isArray(data)) {
		return data.map((row) => pinAgencyId(row, agencyId));
	}
	if (data !== null && data instanceof Object) {
		return { ...(data as Record<string, unknown>), agencyId };
	}
	return data;
}

export type AgencyDb = ReturnType<typeof agencyDb>;
