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
import { CreateQuoteSheet } from "./create-quote-sheet";
import { quotesSearchParams, toQuoteListInput } from "./quotes-search-params";
import { QuotesTable } from "./quotes-table";

export const metadata: Metadata = { title: "Quotes" };

export default function QuotesPage({
	searchParams,
}: PageProps<"/[agency]/quotes">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Quotes</PageShellTitle>
					<PageShellDescription>
						Every priced option the agency has sent a customer.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateQuoteSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Quotes searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Quotes({
	searchParams,
}: Pick<PageProps<"/[agency]/quotes">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		quotesSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.quotes.list.queryOptions(toQuoteListInput(values)),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);

	return (
		<HydrateClient>
			<QuotesTable />
		</HydrateClient>
	);
}
