import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
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
import { PaymentsScreen } from "./payments-screen";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Payments</PageShellTitle>
					<PageShellDescription>
						Customer charges and supplier payables in one place.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Payments />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Payments() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.payments.list.queryOptions({ kind: "all", status: [] }),
		),
		queryClient.prefetchQuery(trpc.users.me.queryOptions()),
	]);

	return (
		<HydrateClient>
			<PaymentsScreen />
		</HydrateClient>
	);
}
