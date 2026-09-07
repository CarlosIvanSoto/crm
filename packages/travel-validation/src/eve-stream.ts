import { z } from "zod";

export type EveStreamEvent = {
	type: string;
	data?: unknown;
};

const text = z.string().nullable().catch(null);

export const eveTurnFailure = z
	.object({ code: text, message: text })
	.catch({ code: null, message: null });

export type EveTurnFailure = z.infer<typeof eveTurnFailure>;
