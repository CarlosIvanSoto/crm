import { db } from "../../src/client";
import { RATE_PROVIDER, SEED_ORG_SLUGS, SEED_USER_EMAILS } from "./config";

export async function resetSeedData(): Promise<void> {
	await db.organization.deleteMany({ where: { slug: { in: SEED_ORG_SLUGS } } });
	await db.user.deleteMany({ where: { email: { in: SEED_USER_EMAILS } } });
	await db.exchangeRate.deleteMany({ where: { provider: RATE_PROVIDER } });
	await db.verification.deleteMany({
		where: { identifier: { in: SEED_USER_EMAILS } },
	});
}
