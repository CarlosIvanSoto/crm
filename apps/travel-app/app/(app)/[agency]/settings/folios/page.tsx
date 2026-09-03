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
import { FoliosForm } from "./folios-form";

export const metadata: Metadata = { title: "Folios" };

export default function FoliosSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Folios</PageShellTitle>
					<PageShellDescription>
						The prefix on every quote and booking number.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Folios />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Folios() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(trpc.agency.profile.queryOptions());

	return (
		<HydrateClient>
			<div className="flex max-w-3xl flex-col gap-6">
				<FoliosForm />
			</div>
		</HydrateClient>
	);
}
