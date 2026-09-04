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
import {
	documentsSearchParams,
	toDocumentListInput,
} from "./documents-search-params";
import { DocumentsTable } from "./documents-table";
import { UploadDocumentSheet } from "./upload-document-sheet";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage({
	searchParams,
}: PageProps<"/[agency]/documents">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Documents</PageShellTitle>
					<PageShellDescription>
						Vouchers, tickets, invoices and ID documents, in one place.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<UploadDocumentSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Documents searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Documents({
	searchParams,
}: Pick<PageProps<"/[agency]/documents">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		documentsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		trpc.documents.list.queryOptions(toDocumentListInput(values)),
	);

	return (
		<HydrateClient>
			<DocumentsTable />
		</HydrateClient>
	);
}
