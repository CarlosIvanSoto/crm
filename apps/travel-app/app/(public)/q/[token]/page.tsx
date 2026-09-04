import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { QuoteDocument } from "./quote-document";

export const instant = false;

export const metadata: Metadata = {
	title: "Your quote",
	robots: { index: false, follow: false },
};

export default async function PublicQuotePage({
	params,
}: PageProps<"/q/[token]">) {
	const { token } = await params;
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	try {
		await queryClient.fetchQuery(trpc.publicQuote.view.queryOptions({ token }));
	} catch (error) {
		unstable_rethrow(error);
		notFound();
	}

	return (
		<HydrateClient>
			<QuoteDocument token={token} />
		</HydrateClient>
	);
}
