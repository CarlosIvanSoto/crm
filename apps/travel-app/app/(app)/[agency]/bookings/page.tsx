import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import {
	bookingsSearchParams,
	toBookingListInput,
} from "./bookings-search-params";
import { BookingsTable } from "./bookings-table";
import { CreateBookingSheet } from "./create-booking-sheet";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage({
	searchParams,
}: PageProps<"/[agency]/bookings">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Bookings</PageShellTitle>
					<PageShellDescription>
						Every trip the agency has sold, with itinerary and payments.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateBookingSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Bookings searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Bookings({
	searchParams,
}: Pick<PageProps<"/[agency]/bookings">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		bookingsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.bookings.list.queryOptions(toBookingListInput(values)),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);

	return (
		<HydrateClient>
			<BookingsTable />
		</HydrateClient>
	);
}
