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
import { FieldsScreen } from "./fields-screen";

export const metadata: Metadata = { title: "Custom fields" };

export default function FieldsSettingsPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Custom fields</PageShellTitle>
					<PageShellDescription>
						Extra fields on customers, travelers, quotes, bookings and
						suppliers.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Fields />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Fields() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.agency.profile.queryOptions()),
		queryClient.prefetchQuery(
			trpc.fields.list.queryOptions({
				entity: "CUSTOMER",
				includeArchived: true,
			}),
		),
	]);

	return (
		<HydrateClient>
			<FieldsScreen />
		</HydrateClient>
	);
}
