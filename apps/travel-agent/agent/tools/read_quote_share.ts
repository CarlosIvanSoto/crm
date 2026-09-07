import { defineTool } from "eve/tools";
import { z } from "zod";
import { agencyDb, db } from "../lib/db";
import { requireAttribute } from "../lib/session-context";

export default defineTool({
	description:
		"Read a quote's public-link share history: whether it was sent, how many times it has been viewed, and when it was first and last opened. Free — call it to see whether a customer has actually looked.",
	inputSchema: z.object({ quoteId: z.string() }),
	async execute({ quoteId }, ctx) {
		const agencyId = requireAttribute(ctx, "agencyId");

		const share = await agencyDb(db, agencyId).quoteShare.findFirst({
			where: { quoteId },
			orderBy: { createdAt: "desc" },
			select: {
				createdAt: true,
				expiresAt: true,
				revokedAt: true,
				firstViewAt: true,
				lastViewAt: true,
				viewCount: true,
			},
		});

		if (!share) {
			return {
				quoteId,
				shared: false as const,
				note: "This quote has no share link on file. It may have been sent by other means, or not sent at all.",
			};
		}

		return {
			quoteId,
			shared: true as const,
			createdAt: share.createdAt.toISOString(),
			expiresAt: share.expiresAt?.toISOString() ?? null,
			revokedAt: share.revokedAt?.toISOString() ?? null,
			firstViewAt: share.firstViewAt?.toISOString() ?? null,
			lastViewAt: share.lastViewAt?.toISOString() ?? null,
			viewCount: share.viewCount,
		};
	},
});
