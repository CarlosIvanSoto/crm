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
import { CreateCustomerSheet } from "./create-customer-sheet";
import {
	customersSearchParams,
	toCustomerListInput,
} from "./customers-search-params";
import { CustomersTable } from "./customers-table";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage({
	searchParams,
}: PageProps<"/[agency]/customers">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Customers</PageShellTitle>
					<PageShellDescription>
						Every person and company the agency sells to.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateCustomerSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Customers searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Customers({
	searchParams,
}: Pick<PageProps<"/[agency]/customers">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		customersSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.customers.list.queryOptions(toCustomerListInput(values)),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);

	return (
		<HydrateClient>
			<CustomersTable />
		</HydrateClient>
	);
}
