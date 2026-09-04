import { randomUUID } from "node:crypto";
import { db } from "@travel/db";

export const suffix = process.env.TEST_RUN_ID ?? "travel-api-spec";

export interface SeededAgency {
	agencyId: string;
	ownerUserId: string;
	customerId: string;
}

export async function seedAgency(tag: string): Promise<SeededAgency> {
	const agencyId = `${suffix}-${tag}-${randomUUID().slice(0, 8)}`;
	const userId = `${agencyId}-user`;

	await db.user.create({
		data: {
			id: userId,
			name: `Owner ${tag}`,
			email: `owner.${agencyId}@example.test`,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	await db.organization.create({
		data: {
			id: agencyId,
			name: agencyId,
			slug: agencyId,
			createdAt: new Date(),
		},
	});

	await db.member.create({
		data: {
			id: `${agencyId}-member`,
			organizationId: agencyId,
			userId,
			role: "owner",
			createdAt: new Date(),
		},
	});

	await db.agencySettings.create({
		data: { agencyId, quotePrefix: "COT", bookingPrefix: "EXP" },
	});

	const customer = await db.customer.create({
		data: { agencyId, name: `Customer ${tag}`, ownerId: userId },
	});

	return { agencyId, ownerUserId: userId, customerId: customer.id };
}

export async function dropAgency(agencyId: string): Promise<void> {
	await db.document.deleteMany({ where: { agencyId } });
	await db.commission.deleteMany({ where: { agencyId } });
	await db.bookingItem.deleteMany({ where: { agencyId } });
	await db.bookingTraveler.deleteMany({ where: { agencyId } });
	await db.booking.deleteMany({ where: { agencyId } });
	await db.quoteItem.deleteMany({ where: { agencyId } });
	await db.quoteOption.deleteMany({ where: { agencyId } });
	await db.quoteShare.deleteMany({ where: { agencyId } });
	await db.quote.deleteMany({ where: { agencyId } });
	await db.traveler.deleteMany({ where: { agencyId } });
	await db.customer.deleteMany({ where: { agencyId } });
	await db.agencySettings.deleteMany({ where: { agencyId } });
	await db.agencyCounter.deleteMany({ where: { agencyId } });
	await db.member.deleteMany({ where: { organizationId: agencyId } });
	await db.organization.deleteMany({ where: { id: agencyId } });
	await db.user.deleteMany({
		where: { email: { endsWith: `.${agencyId}@example.test` } },
	});
}
