import { db } from "../src/client";
import { seedActivities } from "./seed/activities";
import { finaliseCounters, seedAgency } from "./seed/agency";
import { seedAgentTasks } from "./seed/agent";
import { seedBookings } from "./seed/bookings";
import { AGENCIES, SEED_PRNG_SEED } from "./seed/config";
import { seedCustomers, seedSuppliers, seedTravelers } from "./seed/directory";
import { seedDocuments } from "./seed/documents";
import { seedFields, seedSavedViews } from "./seed/fields";
import {
	seedCommissions,
	seedPayments,
	seedSupplierPayments,
} from "./seed/finance";
import { seedQuotes } from "./seed/quotes";
import { makeRandom } from "./seed/random";
import { seedRates } from "./seed/rates";
import { resetSeedData } from "./seed/reset";
import { seedShares } from "./seed/shares";

async function main(): Promise<void> {
	await resetSeedData();
	const rateCount = await seedRates();
	console.log(`Seeded ${rateCount} exchange rates.`);

	const shareLinks: string[] = [];

	for (let agencyIndex = 0; agencyIndex < AGENCIES.length; agencyIndex += 1) {
		const spec = AGENCIES[agencyIndex];
		if (!spec) continue;
		const rng = makeRandom(SEED_PRNG_SEED + agencyIndex * 1009);
		const bag = await seedAgency(spec);

		await seedSuppliers(bag, rng);
		await seedCustomers(bag, rng);
		await seedTravelers(bag, rng);

		const quotesByTag = await seedQuotes(bag, rng);
		const shares = await seedShares(bag, rng, quotesByTag);
		const bookingsByTag = await seedBookings(bag, rng, quotesByTag);

		await seedPayments(bag, rng);
		await seedSupplierPayments(bag, rng);
		await seedCommissions(bag, rng, bookingsByTag);

		await seedFields(bag, rng);
		await seedSavedViews(bag);

		await seedActivities(bag, rng, quotesByTag, bookingsByTag, shares);
		await seedDocuments(bag, rng);
		await seedAgentTasks(bag, rng, quotesByTag);

		await finaliseCounters(bag);

		shareLinks.push(...bag.shareLinks);
		console.log(
			`Seeded ${spec.slug}: ${bag.users.length} users, ${bag.customers.length} customers, ` +
				`${bag.quotes.length} quotes, ${bag.bookings.length} bookings.`,
		);
	}

	console.log(`\nOpen these public quote links (no session needed):`);
	for (const link of shareLinks) {
		console.log(`  ${link}`);
	}
	console.log(`\nEvery account signs in with the password: password123`);
}

main()
	.then(() => db.$disconnect())
	.catch(async (error) => {
		console.error(error);
		await db.$disconnect();
		process.exit(1);
	});
