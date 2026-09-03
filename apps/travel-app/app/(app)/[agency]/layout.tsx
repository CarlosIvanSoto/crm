import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import { AppIconRail, AppIconRailFallback } from "@/components/app-icon-rail";
import { MobileNavProvider } from "@/components/mobile-nav";
import { RecordSheetHost } from "@/components/travel/record-sheet/record-sheet-host";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

export default function AgencyLayout({
	children,
	params,
}: LayoutProps<"/[agency]">) {
	return (
		<MobileNavProvider>
			<div className="isolate flex h-svh flex-col">
				<Suspense fallback={<AppHeaderFallback />}>
					<AgencyHeader params={params} />
				</Suspense>

				<div className="flex min-h-0 flex-1">
					<Suspense fallback={<AppIconRailFallback />}>
						<AppIconRail />
					</Suspense>
					{children}
				</div>

				<Suspense fallback={null}>
					<RecordSheetHost />
				</Suspense>
			</div>
		</MobileNavProvider>
	);
}

async function loadAgency() {
	try {
		return await getServerQueryClient().fetchQuery(
			getServerTrpc().agency.profile.queryOptions(),
		);
	} catch (error) {
		unstable_rethrow(error);
		return null;
	}
}

async function AgencyHeader({
	params,
}: Pick<LayoutProps<"/[agency]">, "params">) {
	await connection();
	const [session, { agency }, profile] = await Promise.all([
		requireSession(),
		params,
		loadAgency(),
	]);

	if (profile && profile.slug !== agency) notFound();

	return (
		<HydrateClient>
			<AppHeader
				user={{
					name: session.user.name,
					email: session.user.email,
					image: session.user.image ?? null,
				}}
			/>
		</HydrateClient>
	);
}
