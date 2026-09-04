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
import { BackToListLink } from "@/components/travel/commissions/commissions-links";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CommissionsReports } from "./commissions-reports";

export const metadata: Metadata = { title: "Commission reports" };

export default function CommissionReportsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Commission reports</PageShellTitle>
					<PageShellDescription>
						Commission by advisor and booked volume by supplier, in base
						currency.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<BackToListLink />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Reports />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Reports() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(trpc.commissions.byAdvisor.queryOptions());

	return (
		<HydrateClient>
			<CommissionsReports />
		</HydrateClient>
	);
}
