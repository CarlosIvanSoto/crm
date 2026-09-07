import { db } from "./db";

export async function upsertConversationStart(input: {
	agencyId: string;
	quoteId: string;
	userId: string | null;
	sessionId: string;
}): Promise<void> {
	const existing = await db.agentConversation.findUnique({
		where: { sessionId: input.sessionId },
		select: { id: true },
	});
	if (existing) return;

	await db.agentConversation.create({
		data: {
			agencyId: input.agencyId,
			quoteId: input.quoteId,
			userId: input.userId,
			sessionId: input.sessionId,
			lastMessageAt: new Date(),
		},
	});
}

export async function noteConversationActivity(
	sessionId: string,
): Promise<void> {
	await db.agentConversation.updateMany({
		where: { sessionId },
		data: { lastMessageAt: new Date() },
	});
}
