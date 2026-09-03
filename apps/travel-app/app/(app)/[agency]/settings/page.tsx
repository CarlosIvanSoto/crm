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
import { AgencyProfileForm } from "./agency-profile-form";

export const metadata: Metadata = { title: "General" };

export default function GeneralSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>General</PageShellTitle>
					<PageShellDescription>
						The agency's tax details, time zone and logo.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<General />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function General() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery(trpc.agency.profile.queryOptions());

	return (
		<HydrateClient>
			<div className="flex max-w-3xl flex-col gap-6">
				<AgencyProfileForm />
			</div>
		</HydrateClient>
	);
}
