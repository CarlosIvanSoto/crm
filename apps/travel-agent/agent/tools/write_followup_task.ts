import { defineTool } from "eve/tools";
import { z } from "zod";
import { agencyDb, db } from "../lib/db";
import { requireAttribute } from "../lib/session-context";

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export default defineTool({
	description:
		"File the drafted follow-up as a task for the quote's advisor. Never sends anything to the customer, and never changes the quote — a human reads the task and decides.",
	inputSchema: z.object({
		quoteId: z.string(),
		message: z
			.string()
			.min(20)
			.max(2000)
			.describe("A follow-up message the advisor could send as-is."),
	}),
	async execute({ quoteId, message }, ctx) {
		const agencyId = requireAttribute(ctx, "agencyId");
		const scoped = agencyDb(db, agencyId);

		const quote = await scoped.quote.findFirst({
			where: { id: quoteId },
			select: { id: true, folio: true, ownerId: true },
		});

		if (!quote) {
			return { filed: false as const, reason: "No such quote." };
		}

		if (!quote.ownerId) {
			return {
				filed: false as const,
				reason: "This quote has no owner to assign the task to.",
			};
		}

		try {
			await scoped.activity.create({
				data: {
					agencyId,
					type: "TASK",
					subject: `Follow up on quote ${quote.folio}`,
					body: message,
					dueAt: new Date(),
					quoteId,
					createdById: quote.ownerId,
					assignedToId: quote.ownerId,
					sourceKey: `quote-followup:${quoteId}:${isoDate(new Date())}`,
				},
			});
		} catch (error) {
			return {
				filed: false as const,
				reason:
					error instanceof Error && error.message.includes("Unique constraint")
						? "A follow-up task for this quote was already filed today."
						: "Could not file the task.",
			};
		}

		return { filed: true as const };
	},
});
