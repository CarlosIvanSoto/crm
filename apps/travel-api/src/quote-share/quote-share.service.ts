import { createHash, randomBytes } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { appUrl } from "@travel/auth";
import { agencyDb, type Db } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { sendQuoteLink } from "./quote-mailer";
import type { CreateShareInput, SendQuoteInput } from "./quote-share.contracts";

const TOKEN_BYTES = 32;

function tokenHash(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function shareUrl(token: string): string {
	return new URL(`/q/${token}`, appUrl).toString();
}

type ResolvedShare = {
	id: string;
	agencyId: string;
	quoteId: string;
	createdById: string;
};

@Injectable()
export class QuoteShareService {
	private readonly logger = new Logger(QuoteShareService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async status(agencyId: string, quoteId: string) {
		const scoped = agencyDb(this.db, agencyId);
		await this.requireQuote(scoped, quoteId);

		const share = await scoped.quoteShare.findFirst({
			where: {
				quoteId,
				revokedAt: null,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			orderBy: { createdAt: "desc" },
			select: {
				createdAt: true,
				expiresAt: true,
				firstViewAt: true,
				lastViewAt: true,
				viewCount: true,
			},
		});

		return {
			enabled: share !== null,
			url: null,
			createdAt: share?.createdAt.toISOString() ?? null,
			expiresAt: share?.expiresAt?.toISOString() ?? null,
			firstViewAt: share?.firstViewAt?.toISOString() ?? null,
			lastViewAt: share?.lastViewAt?.toISOString() ?? null,
			viewCount: share?.viewCount ?? 0,
		};
	}

	async create(agencyId: string, userId: string, input: CreateShareInput) {
		const scoped = agencyDb(this.db, agencyId);
		await this.requireQuote(scoped, input.quoteId);

		const token = randomBytes(TOKEN_BYTES).toString("base64url");
		const expiresAt = input.expiresInDays
			? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
			: null;

		await scoped.quoteShare.updateMany({
			where: { quoteId: input.quoteId, revokedAt: null },
			data: { revokedAt: new Date() },
		});

		await scoped.quoteShare.create({
			data: {
				agencyId,
				quoteId: input.quoteId,
				tokenHash: tokenHash(token),
				expiresAt,
				createdById: userId,
			},
		});

		this.logger.log({
			message: "Quote share created",
			agencyId,
			quoteId: input.quoteId,
		});

		const url = shareUrl(token);

		return {
			enabled: true,
			url,
			createdAt: new Date().toISOString(),
			expiresAt: expiresAt?.toISOString() ?? null,
			firstViewAt: null,
			lastViewAt: null,
			viewCount: 0,
		};
	}

	async revoke(agencyId: string, quoteId: string) {
		const scoped = agencyDb(this.db, agencyId);
		await this.requireQuote(scoped, quoteId);

		await scoped.quoteShare.updateMany({
			where: { quoteId, revokedAt: null },
			data: { revokedAt: new Date() },
		});

		return { id: quoteId };
	}

	async send(agencyId: string, userId: string, input: SendQuoteInput) {
		const scoped = agencyDb(this.db, agencyId);
		const quote = await scoped.quote.findFirst({
			where: { id: input.quoteId },
			select: {
				id: true,
				status: true,
				sentAt: true,
				customer: { select: { name: true, email: true } },
			},
		});
		if (!quote) throw new NotFoundException("That quote does not exist.");

		const to = input.to ?? quote.customer.email;
		if (!to) {
			throw new BadRequestException(
				"This customer has no email. Add one, or send the link by hand.",
			);
		}

		const token = randomBytes(TOKEN_BYTES).toString("base64url");

		await scoped.quoteShare.updateMany({
			where: { quoteId: input.quoteId, revokedAt: null },
			data: { revokedAt: new Date() },
		});

		await scoped.quoteShare.create({
			data: {
				agencyId,
				quoteId: input.quoteId,
				tokenHash: tokenHash(token),
				createdById: userId,
			},
		});

		const url = shareUrl(token);

		const delivery = await sendQuoteLink({
			to,
			customerName: quote.customer.name,
			url,
			message: input.message,
		});

		if (quote.status === "DRAFT" && !quote.sentAt) {
			await scoped.quote.update({
				where: { id: input.quoteId },
				data: { status: "SENT", sentAt: new Date() },
			});
		}

		this.logger.log({
			message: "Quote link sent",
			agencyId,
			quoteId: input.quoteId,
			delivered: delivery.delivered,
		});

		return { delivered: delivery.delivered, url, to };
	}

	async view(token: string) {
		const share = await this.resolve(token);
		const scoped = agencyDb(this.db, share.agencyId);

		await this.db.quoteShare.updateMany({
			where: { id: share.id },
			data: { viewCount: { increment: 1 }, lastViewAt: new Date() },
		});

		const firstView = await this.db.quoteShare.updateMany({
			where: { id: share.id, firstViewAt: null },
			data: { firstViewAt: new Date() },
		});

		if (firstView.count > 0) {
			await scoped.activity.create({
				data: {
					agencyId: share.agencyId,
					type: "SYSTEM",
					subject: "Customer opened the quote link",
					quoteId: share.quoteId,
					createdById: share.createdById,
				},
			});
		}

		const [quote, settings] = await Promise.all([
			scoped.quote.findFirst({
				where: { id: share.quoteId },
				select: {
					folio: true,
					destination: true,
					travelStartDate: true,
					travelEndDate: true,
					paxAdults: true,
					paxChildren: true,
					paxInfants: true,
					validUntil: true,
					notes: true,
					terms: true,
					status: true,
					acceptedOptionId: true,
					customer: { select: { name: true } },
					options: {
						orderBy: { position: "asc" },
						select: {
							id: true,
							label: true,
							isRecommended: true,
							sellTotalBase: true,
							baseCurrency: true,
							items: {
								orderBy: { position: "asc" },
								select: {
									type: true,
									description: true,
									startsAt: true,
									endsAt: true,
									paxCount: true,
									position: true,
									sellAmount: true,
									sellCurrency: true,
									details: true,
								},
							},
						},
					},
				},
			}),
			scoped.agencySettings.findFirst({
				where: { agencyId: share.agencyId },
				select: { legalName: true, logoUrl: true, phone: true, email: true },
			}),
		]);

		if (!quote) throw new NotFoundException("That link is not valid.");

		const organization = await this.db.organization.findUniqueOrThrow({
			where: { id: share.agencyId },
			select: { name: true },
		});

		const expired = quote.validUntil !== null && quote.validUntil < new Date();
		const canAccept =
			(quote.status === "DRAFT" || quote.status === "SENT") && !expired;

		return {
			agency: {
				name: organization.name,
				legalName: settings?.legalName ?? null,
				logoUrl: settings?.logoUrl ?? null,
				phone: settings?.phone ?? null,
				email: settings?.email ?? null,
			},
			quote: {
				folio: quote.folio,
				destination: quote.destination,
				travelStartDate: quote.travelStartDate?.toISOString() ?? null,
				travelEndDate: quote.travelEndDate?.toISOString() ?? null,
				paxAdults: quote.paxAdults,
				paxChildren: quote.paxChildren,
				paxInfants: quote.paxInfants,
				validUntil: quote.validUntil?.toISOString() ?? null,
				notes: quote.notes,
				terms: quote.terms,
				status: quote.status,
				acceptedOptionId: quote.acceptedOptionId,
				expired,
				canAccept,
			},
			customer: { name: quote.customer.name },
			options: quote.options.map((option) => ({
				id: option.id,
				label: option.label,
				isRecommended: option.isRecommended,
				sellTotalBase: option.sellTotalBase?.toNumber() ?? null,
				baseCurrency: option.baseCurrency,
				priced: option.sellTotalBase !== null,
				items: option.items.map((item) => ({
					type: item.type,
					description: item.description,
					startsAt: item.startsAt?.toISOString() ?? null,
					endsAt: item.endsAt?.toISOString() ?? null,
					paxCount: item.paxCount,
					position: item.position,
					sellAmount: item.sellAmount?.toNumber() ?? null,
					sellCurrency: item.sellCurrency,
					details: item.details,
				})),
			})),
		};
	}

	async accept(token: string, optionId: string, name: string) {
		const share = await this.resolve(token);
		const scoped = agencyDb(this.db, share.agencyId);

		const quote = await scoped.quote.findFirst({
			where: { id: share.quoteId },
			select: {
				status: true,
				validUntil: true,
				decidedAt: true,
				acceptedOptionId: true,
				folio: true,
				options: { where: { id: optionId }, select: { id: true } },
			},
		});
		if (!quote) throw new NotFoundException("That link is not valid.");

		if (quote.status === "ACCEPTED" && quote.acceptedOptionId === optionId) {
			return {
				folio: quote.folio,
				optionId,
				acceptedAt: quote.decidedAt?.toISOString() ?? new Date().toISOString(),
			};
		}

		if (quote.status !== "DRAFT" && quote.status !== "SENT") {
			throw new ConflictException("That quote is already decided.");
		}

		if (quote.validUntil && quote.validUntil < new Date()) {
			throw new BadRequestException("That quote expired.");
		}

		if (quote.options.length === 0) {
			throw new NotFoundException("That option is not on this quote.");
		}

		const decidedAt = new Date();

		await this.db.$transaction(async (tx) => {
			await tx.quote.update({
				where: { id: share.quoteId, agencyId: share.agencyId },
				data: {
					status: "ACCEPTED",
					decidedAt,
					acceptedOptionId: optionId,
					acceptedByName: name,
				},
			});
			await tx.activity.create({
				data: {
					agencyId: share.agencyId,
					type: "SYSTEM",
					subject: `${name} accepted the quote`,
					quoteId: share.quoteId,
					createdById: share.createdById,
				},
			});
		});

		this.logger.log({
			message: "Quote accepted by customer",
			agencyId: share.agencyId,
			quoteId: share.quoteId,
			optionId,
		});

		return {
			folio: quote.folio,
			optionId,
			acceptedAt: decidedAt.toISOString(),
		};
	}

	private async resolve(token: string): Promise<ResolvedShare> {
		const share = await this.db.quoteShare.findFirst({
			where: {
				tokenHash: tokenHash(token),
				revokedAt: null,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				quote: { archivedAt: null },
			},
			select: { id: true, agencyId: true, quoteId: true, createdById: true },
		});

		if (!share) throw new NotFoundException("That link is not valid.");

		return share;
	}

	private async requireQuote(
		scoped: ReturnType<typeof agencyDb>,
		quoteId: string,
	): Promise<void> {
		const quote = await scoped.quote.findFirst({
			where: { id: quoteId },
			select: { id: true },
		});
		if (!quote) throw new NotFoundException("That quote does not exist.");
	}
}
