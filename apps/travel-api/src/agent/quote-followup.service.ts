import { Injectable, Logger } from "@nestjs/common";
import { agencyDb, type Db, QuoteStatus } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";
import { AGENT_DISPATCH } from "./agent-dispatch.config";
import { bridge } from "./bridge";
import { QUOTE_FOLLOWUP, QUOTE_FOLLOWUP_DAY_MS } from "./quote-followup-config";

export interface QuoteFollowupResult {
	agencies: number;
	created: number;
	skipped: number;
}

const MAX_ROWS_PER_AGENCY = 200;

@Injectable()
export class QuoteFollowupService {
	private readonly logger = new Logger(QuoteFollowupService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async sweepAllAgencies(): Promise<QuoteFollowupResult> {
		const agencies = await this.db.organization.findMany({
			select: { id: true },
			orderBy: { createdAt: "asc" },
			take: QUOTE_FOLLOWUP.sweep.maxAgenciesPerRun,
		});

		const total: QuoteFollowupResult = {
			agencies: 0,
			created: 0,
			skipped: 0,
		};

		for (const agency of agencies) {
			const one = await this.sweepAgency(agency.id);
			total.agencies += 1;
			total.created += one.created;
			total.skipped += one.skipped;
		}

		this.logger.log({ message: "Quote follow-up sweep finished", ...total });

		if (total.created > 0) this.poke();

		return total;
	}

	private async sweepAgency(
		agencyId: string,
	): Promise<Omit<QuoteFollowupResult, "agencies">> {
		const scoped = agencyDb(this.db, agencyId);
		const now = new Date();

		const one = { created: 0, skipped: 0 };

		const candidates = await scoped.quote.findMany({
			where: {
				status: QuoteStatus.SENT,
				archivedAt: null,
				ownerId: { not: null },
			},
			take: MAX_ROWS_PER_AGENCY,
			select: {
				id: true,
				folio: true,
				sentAt: true,
				shares: {
					orderBy: { createdAt: "desc" },
					take: 1,
					select: { firstViewAt: true },
				},
			},
		});

		for (const quote of candidates) {
			const eligible = await this.isEligible(scoped, agencyId, quote, now);
			if (!eligible) {
				one.skipped += 1;
				continue;
			}

			const daysAgo = quote.sentAt
				? Math.floor(
						(now.getTime() - quote.sentAt.getTime()) / QUOTE_FOLLOWUP_DAY_MS,
					)
				: 0;

			await scoped.agentTask.create({
				data: {
					agencyId,
					kind: "quote-followup",
					reason: `Quote ${quote.folio} was sent ${daysAgo} days ago and is still undecided.`,
					quoteId: quote.id,
					subject: quote.id,
					dueAt: now,
				},
			});

			one.created += 1;
		}

		return one;
	}

	private async isEligible(
		scoped: ReturnType<typeof agencyDb>,
		_agencyId: string,
		quote: {
			id: string;
			sentAt: Date | null;
			shares: { firstViewAt: Date | null }[];
		},
		now: Date,
	): Promise<boolean> {
		const openTask = await scoped.agentTask.findFirst({
			where: { quoteId: quote.id, kind: "quote-followup", finishedAt: null },
			select: { id: true },
		});
		if (openTask) return false;

		const lastFollowup = await scoped.activity.findFirst({
			where: {
				quoteId: quote.id,
				sourceKey: { startsWith: `quote-followup:${quote.id}:` },
			},
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});
		if (
			lastFollowup &&
			now.getTime() - lastFollowup.createdAt.getTime() <
				QUOTE_FOLLOWUP.reminderIntervalDays * QUOTE_FOLLOWUP_DAY_MS
		) {
			return false;
		}

		const firstViewAt = quote.shares[0]?.firstViewAt ?? null;
		const since =
			firstViewAt &&
			(!quote.sentAt || firstViewAt.getTime() > quote.sentAt.getTime())
				? firstViewAt
				: quote.sentAt;
		if (!since) return false;

		return (
			now.getTime() - since.getTime() >=
			QUOTE_FOLLOWUP.firstCheckAfterDays * QUOTE_FOLLOWUP_DAY_MS
		);
	}

	private poke(): void {
		const agent = bridge();
		if (!agent) return;

		void fetch(agent.url("/internal/travel/dispatch"), {
			method: "POST",
			headers: { authorization: `Bearer ${agent.secret}` },
			signal: AbortSignal.timeout(AGENT_DISPATCH.poke.timeoutMs),
		}).catch((error) => {
			this.logger.debug({
				message: "Travel agent poke did not land; the cron will pick this up",
				reason: error instanceof Error ? error.message : String(error),
			});
		});
	}
}
