"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import type { DocumentAnchor } from "@/components/travel/documents/document-meta";
import type { FieldEntity } from "@/components/travel/fields/fields-entity";
import { useTRPC } from "./client";

type Settle = "all" | "record";

type Options = {
	settle?: Settle;
};

type RecordKind = "customer" | "traveler" | "supplier" | "quote" | "booking";

const ENTITY_FOR = {
	customer: "CUSTOMER",
	traveler: "TRAVELER",
	supplier: "SUPPLIER",
	quote: "QUOTE",
	booking: "BOOKING",
} as const satisfies Record<RecordKind, FieldEntity>;

type RemovedRecord = { kind: RecordKind; id: string };

type RemovedRecords = { kind: RecordKind; ids: string[] };

export type TravelCache = {
	agentConversation(quoteId?: string, options?: Options): Promise<void>;
	customer(id?: string, options?: Options): Promise<void>;
	traveler(id?: string, options?: Options): Promise<void>;
	supplier(id?: string, options?: Options): Promise<void>;
	quote(id?: string, options?: Options): Promise<void>;
	booking(id?: string, options?: Options): Promise<void>;
	payment(bookingId?: string, options?: Options): Promise<void>;
	commission(bookingId?: string, options?: Options): Promise<void>;
	document(anchor?: DocumentAnchor, options?: Options): Promise<void>;
	activity(options?: Options): Promise<void>;
	fields(entity?: RecordKind, options?: Options): Promise<void>;
	savedViews(entity?: RecordKind, options?: Options): Promise<void>;
	agency(options?: Options): Promise<void>;
	currency(options?: Options): Promise<void>;
	removed(record: RemovedRecord): Promise<void>;
	removedMany(records: RemovedRecords): Promise<void>;
	everything(): Promise<void>;
};

export function useTravelCache(): TravelCache {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const run = (
		record: QueryKey[],
		rest: QueryKey[],
		{ settle = "all" }: Options = {},
	): Promise<void> => {
		const awaited = settle === "all" ? [...record, ...rest] : record;
		const behind = settle === "all" ? [] : rest;

		for (const queryKey of behind) {
			void queryClient.invalidateQueries({ queryKey });
		}

		return Promise.all(
			awaited.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		).then(() => undefined);
	};

	const activityKeys = () => [
		trpc.activities.timeline.pathKey(),
		trpc.activities.timelineCounts.queryKey(),
		trpc.activities.tasks.queryKey(),
	];

	const listKeys = () => [
		trpc.customers.list.queryKey(),
		trpc.travelers.list.queryKey(),
		trpc.suppliers.list.queryKey(),
		trpc.quotes.list.queryKey(),
		trpc.bookings.list.queryKey(),
	];

	const BY_ID = {
		customer: trpc.customers.byId,
		traveler: trpc.travelers.byId,
		supplier: trpc.suppliers.byId,
		quote: trpc.quotes.byId,
		booking: trpc.bookings.byId,
	} as const;

	const removeRecords = (kind: RecordKind, ids: string[]): Promise<void> => {
		const byId = BY_ID[kind];
		const goneKeys = ids.map((id) => byId.queryKey({ id }));
		const gone = new Set(goneKeys.map((key) => JSON.stringify(key)));

		for (const record of Object.values(BY_ID)) {
			void queryClient.invalidateQueries({
				queryKey: record.queryKey(),
				predicate: (query) => !gone.has(JSON.stringify(query.queryKey)),
			});
		}

		for (const queryKey of goneKeys) {
			void queryClient.invalidateQueries({
				queryKey,
				exact: true,
				refetchType: "none",
			});
		}

		return run([...listKeys(), ...activityKeys()], []);
	};

	const record = (kind: RecordKind, id?: string): QueryKey =>
		id ? BY_ID[kind].queryKey({ id }) : BY_ID[kind].queryKey();

	return {
		agentConversation: (quoteId, options) =>
			run(
				[
					quoteId
						? trpc.agentConversation.list.queryKey({ quoteId })
						: trpc.agentConversation.list.queryKey(),
					quoteId
						? trpc.agentConversation.latest.queryKey({ quoteId })
						: trpc.agentConversation.latest.queryKey(),
				],
				[],
				options,
			),

		customer: (id, options) =>
			run(
				[record("customer", id)],
				[...listKeys(), ...activityKeys()],
				options,
			),

		traveler: (id, options) =>
			run(
				[record("traveler", id)],
				[
					...listKeys(),
					...activityKeys(),
					trpc.travelers.options.queryKey(),
					trpc.documents.list.queryKey(),
				],
				options,
			),

		supplier: (id, options) =>
			run(
				[record("supplier", id)],
				[...listKeys(), trpc.suppliers.options.queryKey()],
				options,
			),

		quote: (id, options) =>
			run(
				[record("quote", id)],
				[
					...listKeys(),
					...activityKeys(),
					trpc.bookings.list.queryKey(),
					trpc.quoteShare.status.queryKey(),
				],
				options,
			),

		booking: (id, options) =>
			run(
				[record("booking", id)],
				[
					...listKeys(),
					...activityKeys(),
					trpc.payments.list.queryKey(),
					trpc.commissions.list.queryKey(),
					trpc.commissions.byBooking.queryKey(),
					trpc.commissions.byAdvisor.queryKey(),
					trpc.currency.settings.queryKey(),
					trpc.documents.list.queryKey(),
				],
				options,
			),

		payment: (bookingId, options) =>
			run(
				[trpc.payments.list.queryKey()],
				[
					bookingId
						? trpc.bookings.byId.queryKey({ id: bookingId })
						: trpc.bookings.byId.queryKey(),
					trpc.bookings.list.queryKey(),
				],
				options,
			),

		commission: (bookingId, options) =>
			run(
				[
					trpc.commissions.list.queryKey(),
					bookingId
						? trpc.commissions.byBooking.queryKey({ bookingId })
						: trpc.commissions.byBooking.queryKey(),
				],
				[
					trpc.commissions.byAdvisor.queryKey(),
					trpc.commissions.bySupplier.queryKey(),
					bookingId
						? trpc.bookings.byId.queryKey({ id: bookingId })
						: trpc.bookings.byId.queryKey(),
					trpc.bookings.list.queryKey(),
				],
				options,
			),

		document: (anchor, options) =>
			run(
				[
					trpc.documents.list.queryKey(),
					...(anchor ? [trpc.documents.list.queryKey({ ...anchor })] : []),
				],
				[
					anchor && "bookingId" in anchor
						? trpc.bookings.byId.queryKey({ id: anchor.bookingId })
						: trpc.bookings.byId.queryKey(),
					anchor && "travelerId" in anchor
						? trpc.travelers.byId.queryKey({ id: anchor.travelerId })
						: trpc.travelers.byId.queryKey(),
				],
				options,
			),

		activity: (options) =>
			run(
				activityKeys(),
				[
					...listKeys(),
					trpc.customers.byId.queryKey(),
					trpc.bookings.byId.queryKey(),
					trpc.dashboard.summary.queryKey(),
				],
				options,
			),

		fields: (entity, options) =>
			run(
				[
					trpc.fields.list.queryKey(),
					entity
						? trpc.fields.filters.queryKey({ entity: ENTITY_FOR[entity] })
						: trpc.fields.filters.queryKey(),
				],
				[...listKeys()],
				options,
			),

		savedViews: (entity, options) =>
			run(
				[
					entity
						? trpc.savedViews.list.queryKey({ entity: ENTITY_FOR[entity] })
						: trpc.savedViews.list.queryKey(),
				],
				[],
				options,
			),

		agency: (options) =>
			run(
				[trpc.agency.profile.queryKey(), trpc.agency.members.queryKey()],
				[trpc.agency.invitations.queryKey(), trpc.users.list.queryKey()],
				options,
			),

		currency: (options) =>
			run(
				[trpc.currency.settings.queryKey()],
				[
					...listKeys(),
					trpc.bookings.byId.queryKey(),
					trpc.quotes.byId.queryKey(),
				],
				options,
			),

		removed: ({ kind, id }) => removeRecords(kind, [id]),

		removedMany: ({ kind, ids }) => removeRecords(kind, ids),

		everything: () => queryClient.invalidateQueries(),
	};
}
