import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import type { ToolContext } from "eve/tools";
import writeFollowupTask from "../agent/tools/write_followup_task";

const suffix = process.env.TEST_RUN_ID ?? "travel-agent-write-followup-spec";
const agencyId = `${suffix}-agency`;

let ownerId: string;
let customerId: string;
let quoteId: string;
let orphanQuoteId: string;

function ctxFor(): ToolContext {
	return {
		session: {
			id: "session_1",
			auth: {
				current: {
					principalId: "advisor_1",
					attributes: { agencyId, quoteId: "" },
				},
				initiator: null,
			},
		},
	} as unknown as ToolContext;
}

beforeAll(async () => {
	await db.organization.create({
		data: {
			id: agencyId,
			name: agencyId,
			slug: agencyId,
			createdAt: new Date(),
		},
	});

	const owner = await db.user.create({
		data: {
			id: `${agencyId}-owner`,
			name: "Owner",
			email: `owner.${agencyId}@example.test`,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
	ownerId = owner.id;

	const customer = await db.customer.create({
		data: { agencyId, name: "Customer", ownerId },
	});
	customerId = customer.id;

	const quote = await db.quote.create({
		data: { agencyId, folio: `COT-${agencyId}`, customerId, ownerId },
	});
	quoteId = quote.id;

	const orphan = await db.quote.create({
		data: { agencyId, folio: `COT-${agencyId}-orphan`, customerId },
	});
	orphanQuoteId = orphan.id;
});

afterAll(async () => {
	await db.activity.deleteMany({ where: { agencyId } });
	await db.quote.deleteMany({ where: { agencyId } });
	await db.customer.deleteMany({ where: { agencyId } });
	await db.organization.deleteMany({ where: { id: agencyId } });
	await db.user.deleteMany({
		where: { email: { endsWith: `.${agencyId}@example.test` } },
	});
	await db.$disconnect();
});

describe("write_followup_task", () => {
	it("files a TASK activity assigned to the quote's owner", async () => {
		const result = await writeFollowupTask.execute(
			{
				quoteId,
				message: "The customer opened the link twice but has not replied.",
			},
			ctxFor(),
		);

		expect(result).toEqual({ filed: true });

		const activity = await db.activity.findFirst({
			where: { quoteId, type: "TASK" },
		});
		expect(activity?.assignedToId).toBe(ownerId);
		expect(activity?.createdById).toBe(ownerId);
	});

	it("does not duplicate the same day's follow-up", async () => {
		const second = await writeFollowupTask.execute(
			{ quoteId, message: "A second drafted message for the same day." },
			ctxFor(),
		);

		expect(second.filed).toBe(false);

		const activities = await db.activity.findMany({
			where: { quoteId, type: "TASK" },
		});
		expect(activities).toHaveLength(1);
	});

	it("refuses a quote with no owner", async () => {
		const result = await writeFollowupTask.execute(
			{ quoteId: orphanQuoteId, message: "This quote has no owner to notify." },
			ctxFor(),
		);

		expect(result).toEqual({
			filed: false,
			reason: "This quote has no owner to assign the task to.",
		});
	});

	it("reports a missing quote instead of throwing", async () => {
		const result = await writeFollowupTask.execute(
			{ quoteId: "does-not-exist", message: "A message long enough to pass." },
			ctxFor(),
		);

		expect(result).toEqual({ filed: false, reason: "No such quote." });
	});
});
