import { defineTool } from "eve/tools";
import { z } from "zod";
import { agencyDb, db } from "../lib/db";
import { requireAttribute } from "../lib/session-context";

export default defineTool({
	description:
		"Read a customer's name, email, phone and WhatsApp number. Free — call it once you have the customerId from read_quote.",
	inputSchema: z.object({ customerId: z.string() }),
	async execute({ customerId }, ctx) {
		const agencyId = requireAttribute(ctx, "agencyId");

		const customer = await agencyDb(db, agencyId).customer.findFirst({
			where: { id: customerId },
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				whatsapp: true,
			},
		});

		if (!customer) {
			return { found: false as const, reason: "No such customer." };
		}

		return {
			found: true as const,
			customerId: customer.id,
			name: customer.name,
			email: customer.email,
			phone: customer.phone,
			whatsapp: customer.whatsapp,
		};
	},
});
