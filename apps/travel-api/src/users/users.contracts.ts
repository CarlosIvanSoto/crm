import { z } from "zod";

export const userOptionOutput = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
		role: z.enum(["owner", "admin", "agent", "accountant"]),
	}),
);
