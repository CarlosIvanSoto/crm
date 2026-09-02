import { afterAll } from "bun:test";

afterAll(async () => {
	if (
		!process.env.TRAVEL_DATABASE_URL &&
		!process.env.TRAVEL_TEST_DATABASE_URL
	) {
		return;
	}
	const { db } = await import("@travel/db");
	await db.$disconnect();
});
