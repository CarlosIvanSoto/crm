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
import { CreateSupplierSheet } from "./create-supplier-sheet";
import {
	suppliersSearchParams,
	toSupplierListInput,
} from "./suppliers-search-params";
import { SuppliersTable } from "./suppliers-table";

export const metadata: Metadata = { title: "Suppliers" };

export default function SuppliersPage({
	searchParams,
}: PageProps<"/[agency]/suppliers">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Suppliers</PageShellTitle>
					<PageShellDescription>
						Every wholesaler, hotel and operator the agency buys from.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateSupplierSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Suppliers searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Suppliers({
	searchParams,
}: Pick<PageProps<"/[agency]/suppliers">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		suppliersSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		trpc.suppliers.list.queryOptions(toSupplierListInput(values)),
	);

	return (
		<HydrateClient>
			<SuppliersTable />
		</HydrateClient>
	);
}
