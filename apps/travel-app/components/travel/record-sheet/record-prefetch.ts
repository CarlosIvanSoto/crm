"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import type { RecordRef } from "./record-stack";

export function usePrefetchRecord() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useCallback(
		({ kind, id }: RecordRef) => {
			switch (kind) {
				case "customer":
					void queryClient.prefetchQuery(
						trpc.customers.byId.queryOptions({ id }),
					);
					return;
				case "traveler":
					void queryClient.prefetchQuery(
						trpc.travelers.byId.queryOptions({ id }),
					);
					return;
				case "supplier":
					void queryClient.prefetchQuery(
						trpc.suppliers.byId.queryOptions({ id }),
					);
					return;
				case "quote":
					void queryClient.prefetchQuery(trpc.quotes.byId.queryOptions({ id }));
					return;
				case "booking":
					void queryClient.prefetchQuery(
						trpc.bookings.byId.queryOptions({ id }),
					);
					return;
			}
		},
		[trpc, queryClient],
	);
}
