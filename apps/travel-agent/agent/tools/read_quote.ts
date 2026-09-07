import { defineTool } from "eve/tools";
import { z } from "zod";
import { agencyDb, db } from "../lib/db";
import { requireAttribute } from "../lib/session-context";

export default defineTool({
	description:
		"Read a quote: its folio, destination, dates, party size, status and every option with its line items. Free, and the best evidence there is — call it first.",
	inputSchema: z.object({ quoteId: z.string() }),
	async execute({ quoteId }, ctx) {
		const agencyId = requireAttribute(ctx, "agencyId");
		const sessionQuoteId = requireAttribute(ctx, "quoteId");

		if (quoteId !== sessionQuoteId) {
			return {
				found: false as const,
				reason: "This session is scoped to a different quote.",
			};
		}

		const quote = await agencyDb(db, agencyId).quote.findFirst({
			where: { id: quoteId },
			select: {
				id: true,
				folio: true,
				status: true,
				destination: true,
				travelStartDate: true,
				travelEndDate: true,
				paxAdults: true,
				paxChildren: true,
				paxInfants: true,
				currency: true,
				notes: true,
				validUntil: true,
				sentAt: true,
				decidedAt: true,
				customerId: true,
				ownerId: true,
				options: {
					orderBy: { position: "asc" },
					select: {
						id: true,
						label: true,
						isRecommended: true,
						items: {
							orderBy: { position: "asc" },
							select: {
								type: true,
								description: true,
								startsAt: true,
								endsAt: true,
								startLocation: true,
								endLocation: true,
								status: true,
							},
						},
					},
				},
			},
		});

		if (!quote) return { found: false as const, reason: "No such quote." };

		return {
			found: true as const,
			quoteId: quote.id,
			customerId: quote.customerId,
			ownerId: quote.ownerId,
			folio: quote.folio,
			status: quote.status,
			destination: quote.destination,
			travelStartDate: quote.travelStartDate?.toISOString() ?? null,
			travelEndDate: quote.travelEndDate?.toISOString() ?? null,
			pax: {
				adults: quote.paxAdults,
				children: quote.paxChildren,
				infants: quote.paxInfants,
			},
			currency: quote.currency,
			validUntil: quote.validUntil?.toISOString() ?? null,
			sentAt: quote.sentAt?.toISOString() ?? null,
			decidedAt: quote.decidedAt?.toISOString() ?? null,
			notes: quote.notes,
			options: quote.options.map((option) => ({
				id: option.id,
				label: option.label,
				isRecommended: option.isRecommended,
				items: option.items.map((item) => ({
					type: item.type,
					description: item.description,
					startsAt: item.startsAt?.toISOString() ?? null,
					endsAt: item.endsAt?.toISOString() ?? null,
					startLocation: item.startLocation,
					endLocation: item.endLocation,
					status: item.status,
				})),
			})),
		};
	},
});
