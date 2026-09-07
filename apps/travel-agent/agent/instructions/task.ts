import { defineDynamic, defineInstructions } from "eve/instructions";
import { upsertConversationStart } from "../lib/conversations";
import { agencyDb, db } from "../lib/db";
import { attribute, principalId } from "../lib/session-context";

export default defineDynamic({
	events: {
		"session.started": async (_event, ctx) => {
			const agencyId = attribute(ctx, "agencyId");
			const quoteId = attribute(ctx, "quoteId");
			const taskKind = attribute(ctx, "taskKind");
			const reason = attribute(ctx, "reason");

			if (!agencyId || !quoteId) {
				return defineInstructions({
					markdown:
						"No quote is named for this session. Say that you cannot help without one, and stop.",
				});
			}

			await upsertConversationStart({
				agencyId,
				quoteId,
				userId: taskKind ? null : principalId(ctx),
				sessionId: ctx.session.id,
			});

			const quote = await agencyDb(db, agencyId).quote.findFirst({
				where: { id: quoteId },
				select: { folio: true, destination: true },
			});

			if (!quote) {
				return defineInstructions({
					markdown: `Quote \`${quoteId}\` no longer exists in this agency. Say so, and stop.`,
				});
			}

			const heading = `You are working on quote \`${quoteId}\` (folio ${quote.folio}${
				quote.destination ? `, ${quote.destination}` : ""
			}).`;

			const task = taskKind
				? `This session was dispatched by the daily follow-up sweep. ${reason ?? ""} Read the quote with read_quote, its share status with read_quote_share, and its customer with read_customer. Then call write_followup_task exactly once with a short, specific follow-up message a human could send as-is. If the quote has no owner, say so and stop without calling write_followup_task.`
				: "An advisor opened this conversation from the quote's record sheet. Answer their questions using read_quote, read_quote_share and read_customer. Call write_followup_task only if the advisor asks you to file a follow-up task.";

			return defineInstructions({ markdown: `${heading} ${task}` });
		},
	},
});
