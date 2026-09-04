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
import { DashboardSummary } from "./dashboard-summary";
import {
	OverviewScopeToggle,
	OverviewScopeToggleFallback,
} from "./overview-scope";
import { loadOverviewSearchParams } from "./overview-search-params";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({
	searchParams,
}: PageProps<"/[agency]">) {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Dashboard</PageShellTitle>
					<PageShellDescription>
						Sales, margin, overdue charges and upcoming departures.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={<OverviewScopeToggleFallback />}>
						<OverviewScopeToggle />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Summary searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Summary({
	searchParams,
}: Pick<PageProps<"/[agency]">, "searchParams">) {
	const [, { scope }] = await Promise.all([
		requireSession(),
		loadOverviewSearchParams(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(trpc.dashboard.summary.queryOptions({ scope })),
		queryClient.prefetchQuery(trpc.commissions.byAdvisor.queryOptions()),
	]);

	return (
		<HydrateClient>
			<DashboardSummary />
		</HydrateClient>
	);
}
