import { z } from "zod";

export const conversationQuoteIdInput = z.object({ quoteId: z.string() });

export const conversationOutput = z.object({
	id: z.string(),
	quoteId: z.string(),
	userId: z.string().nullable(),
	sessionId: z.string().nullable(),
	lastMessageAt: z.string().nullable(),
	createdAt: z.string(),
});

export const conversationListOutput = z.array(conversationOutput);

export const conversationLatestOutput = conversationOutput.nullable();
