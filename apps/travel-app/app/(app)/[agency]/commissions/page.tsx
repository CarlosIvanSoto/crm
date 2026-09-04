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
import { ReportsLink } from "@/components/travel/commissions/commissions-links";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import {
	commissionsSearchParams,
	toCommissionListInput,
} from "./commissions-search-params";
import { CommissionsTable } from "./commissions-table";
import { CreateCommissionSheet } from "./create-commission-sheet";

export const metadata: Metadata = { title: "Commissions" };

export default function CommissionsPage({
	searchParams,
}: PageProps<"/[agency]/commissions">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Commissions</PageShellTitle>
					<PageShellDescription>
						What the agency owes each advisor, one booking at a time.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<ReportsLink />
					<CreateCommissionSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Commissions searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Commissions({
	searchParams,
}: Pick<PageProps<"/[agency]/commissions">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		commissionsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		trpc.commissions.list.queryOptions(toCommissionListInput(values)),
	);

	return (
		<HydrateClient>
			<CommissionsTable />
		</HydrateClient>
	);
}
