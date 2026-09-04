"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function useDownloadDocument() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [pendingId, setPendingId] = useState<string | null>(null);

	const download = async (id: string) => {
		setPendingId(id);
		try {
			const result = await queryClient.fetchQuery(
				trpc.documents.downloadUrl.queryOptions({ id }),
			);
			window.open(result.url, "_blank", "noopener,noreferrer");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not open that file.",
			);
		} finally {
			setPendingId(null);
		}
	};

	return { download, pending: (id: string) => pendingId === id };
}
