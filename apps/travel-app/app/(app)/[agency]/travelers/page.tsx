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
import { CreateTravelerSheet } from "./create-traveler-sheet";
import {
	toTravelerListInput,
	travelersSearchParams,
} from "./travelers-search-params";
import { TravelersTable } from "./travelers-table";

export const metadata: Metadata = { title: "Travelers" };

export default function TravelersPage({
	searchParams,
}: PageProps<"/[agency]/travelers">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Travelers</PageShellTitle>
					<PageShellDescription>
						Every person who flies, with passport and loyalty on file.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateTravelerSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Travelers searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Travelers({
	searchParams,
}: Pick<PageProps<"/[agency]/travelers">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		travelersSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.travelers.list.queryOptions(toTravelerListInput(values)),
		),
		queryClient.prefetchQuery(trpc.customers.options.queryOptions({ q: "" })),
	]);

	return (
		<HydrateClient>
			<TravelersTable />
		</HydrateClient>
	);
}
