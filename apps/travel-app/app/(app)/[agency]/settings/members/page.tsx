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
import { MembersScreen } from "./members-screen";

export const metadata: Metadata = { title: "Members" };

export default function MembersSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Members</PageShellTitle>
					<PageShellDescription>
						Everyone who can sign in to this agency.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Members />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Members() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.agency.profile.queryOptions()),
		queryClient.prefetchQuery(trpc.agency.members.queryOptions()),
		queryClient.prefetchQuery(trpc.agency.invitations.queryOptions()),
	]);

	return (
		<HydrateClient>
			<div className="flex max-w-3xl flex-col gap-6">
				<MembersScreen />
			</div>
		</HydrateClient>
	);
}
