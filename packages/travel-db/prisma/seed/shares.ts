import { createHash } from "node:crypto";
import { db } from "../../src/client";
import type { AgencyBag, SeededQuote } from "./context";
import { daysFromNow, type Rng, tokenFromRng } from "./random";

interface ShareSpec {
	quoteTag: string;
	viewCount: number;
	firstViewDaysAgo: number | null;
	lastViewDaysAgo: number | null;
	expiresInDays: number | null;
	revokedDaysAgo: number | null;
}

const SHARE_SPECS: ShareSpec[] = [
	{
		quoteTag: "agentEligible",
		viewCount: 4,
		firstViewDaysAgo: 5,
		lastViewDaysAgo: 1,
		expiresInDays: null,
		revokedDaysAgo: null,
	},
	{
		quoteTag: "unpricedOption",
		viewCount: 0,
		firstViewDaysAgo: null,
		lastViewDaysAgo: null,
		expiresInDays: 14,
		revokedDaysAgo: null,
	},
	{
		quoteTag: "nonBase",
		viewCount: 2,
		firstViewDaysAgo: 6,
		lastViewDaysAgo: 4,
		expiresInDays: null,
		revokedDaysAgo: 2,
	},
	{
		quoteTag: "declined",
		viewCount: 1,
		firstViewDaysAgo: 8,
		lastViewDaysAgo: 8,
		expiresInDays: -3,
		revokedDaysAgo: null,
	},
	{
		quoteTag: "expired",
		viewCount: 3,
		firstViewDaysAgo: 12,
		lastViewDaysAgo: 9,
		expiresInDays: null,
		revokedDaysAgo: null,
	},
	{
		quoteTag: "acceptedPublic",
		viewCount: 5,
		firstViewDaysAgo: 4,
		lastViewDaysAgo: 2,
		expiresInDays: null,
		revokedDaysAgo: null,
	},
];

export interface SeededShare {
	quoteTag: string;
	quoteId: string;
	createdById: string;
	firstViewAt: Date | null;
}

export async function seedShares(
	bag: AgencyBag,
	rng: Rng,
	quotesByTag: Map<string, SeededQuote>,
): Promise<SeededShare[]> {
	const admin = bag.users.find((user) => user.role === "admin") ?? bag.users[0];
	const seeded: SeededShare[] = [];

	for (const spec of SHARE_SPECS) {
		const quote = quotesByTag.get(spec.quoteTag);
		if (!quote || !admin) continue;

		const createdById = quote.ownerId ?? admin.id;
		const token = tokenFromRng(rng);
		const tokenHash = createHash("sha256").update(token).digest("hex");
		const firstViewAt =
			spec.firstViewDaysAgo === null
				? null
				: daysFromNow(-spec.firstViewDaysAgo);

		await db.quoteShare.create({
			data: {
				agencyId: bag.agencyId,
				quoteId: quote.id,
				tokenHash,
				createdById,
				viewCount: spec.viewCount,
				firstViewAt,
				lastViewAt:
					spec.lastViewDaysAgo === null
						? null
						: daysFromNow(-spec.lastViewDaysAgo),
				expiresAt:
					spec.expiresInDays === null ? null : daysFromNow(spec.expiresInDays),
				revokedAt:
					spec.revokedDaysAgo === null
						? null
						: daysFromNow(-spec.revokedDaysAgo),
				createdAt: daysFromNow(-Math.max(spec.firstViewDaysAgo ?? 3, 3)),
			},
		});

		const openable =
			spec.revokedDaysAgo === null &&
			(spec.expiresInDays === null || spec.expiresInDays > 0);
		if (openable) {
			bag.shareLinks.push(`${bag.spec.slug}  ${quote.folio}  /q/${token}`);
		}

		seeded.push({
			quoteTag: spec.quoteTag,
			quoteId: quote.id,
			createdById,
			firstViewAt,
		});
	}

	return seeded;
}
