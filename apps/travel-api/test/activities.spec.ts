import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import type { TaskListInput } from "../src/activities/activities.contracts";
import { ActivitiesService } from "../src/activities/activities.service";
import { ActivityStampService } from "../src/travel/activity-stamp.service";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const activities = new ActivitiesService(db, new ActivityStampService(db));

const DAY = 24 * 60 * 60 * 1000;

const LIST: TaskListInput = {
	q: "",
	sort: "",
	dir: "asc",
	page: 1,
	pageSize: 25,
	window: "all",
	assignedToId: null,
	bookingId: null,
};

let a: SeededAgency;
let agentOne: string;
let agentTwo: string;

async function addMember(
	agencyId: string,
	tag: string,
	role: "agent" | "admin",
): Promise<string> {
	const user = await db.user.create({
		data: {
			id: `${agencyId}-${tag}`,
			name: tag,
			email: `${tag}.${agencyId}@example.test`,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
	await db.member.create({
		data: {
			id: `${agencyId}-${tag}-member`,
			organizationId: agencyId,
			userId: user.id,
			role,
			createdAt: new Date(),
		},
	});
	return user.id;
}

beforeAll(async () => {
	a = await seedAgency("act");
	agentOne = await addMember(a.agencyId, "agent-one", "agent");
	agentTwo = await addMember(a.agencyId, "agent-two", "agent");
});

afterEach(async () => {
	await db.activity.deleteMany({ where: { agencyId: a.agencyId } });
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await db.$disconnect();
});

describe("activities tasks", () => {
	it("shows an agent only the tasks assigned to them", async () => {
		await activities.create(
			a.agencyId,
			{
				type: "TASK",
				subject: "Owner writes, agent one does",
				customerId: a.customerId,
				assignedToId: agentOne,
			},
			a.ownerUserId,
		);
		await activities.create(
			a.agencyId,
			{
				type: "TASK",
				subject: "Agent one writes, agent two does",
				customerId: a.customerId,
				assignedToId: agentTwo,
			},
			agentOne,
		);

		const forAgentOne = await activities.tasks(
			a.agencyId,
			"agent",
			agentOne,
			LIST,
		);

		expect(forAgentOne.rows).toHaveLength(1);
		expect(forAgentOne.rows[0]?.subject).toBe("Owner writes, agent one does");

		const forOwner = await activities.tasks(
			a.agencyId,
			"owner",
			a.ownerUserId,
			LIST,
		);
		expect(forOwner.rows).toHaveLength(2);
	});

	it("rejects a create assigned to a non-member", async () => {
		await expect(
			activities.create(
				a.agencyId,
				{
					type: "TASK",
					subject: "Nobody here",
					customerId: a.customerId,
					assignedToId: "user-that-is-not-a-member",
				},
				a.ownerUserId,
			),
		).rejects.toThrow();
	});

	it("moves a task off the source agent when reassigned", async () => {
		const task = await activities.create(
			a.agencyId,
			{
				type: "TASK",
				subject: "Reassign me",
				customerId: a.customerId,
				assignedToId: agentOne,
			},
			a.ownerUserId,
		);

		await activities.assign(a.agencyId, "owner", a.ownerUserId, {
			id: task.id,
			assignedToId: agentTwo,
		});

		const forAgentOne = await activities.tasks(
			a.agencyId,
			"agent",
			agentOne,
			LIST,
		);
		expect(forAgentOne.rows).toHaveLength(0);

		const forAgentTwo = await activities.tasks(
			a.agencyId,
			"agent",
			agentTwo,
			LIST,
		);
		expect(forAgentTwo.rows).toHaveLength(1);
	});

	it("sorts a past-due task into overdue, a today task into today and week", async () => {
		await activities.create(
			a.agencyId,
			{
				type: "TASK",
				subject: "Past due",
				customerId: a.customerId,
				assignedToId: agentOne,
				dueAt: new Date(Date.now() - 3 * DAY).toISOString(),
			},
			a.ownerUserId,
		);
		await activities.create(
			a.agencyId,
			{
				type: "TASK",
				subject: "Due today",
				customerId: a.customerId,
				assignedToId: agentOne,
				dueAt: new Date().toISOString(),
			},
			a.ownerUserId,
		);

		const overdue = await activities.tasks(a.agencyId, "agent", agentOne, {
			...LIST,
			window: "overdue",
		});
		expect(overdue.rows.map((row) => row.subject)).toEqual(["Past due"]);

		const today = await activities.tasks(a.agencyId, "agent", agentOne, {
			...LIST,
			window: "today",
		});
		expect(today.rows.map((row) => row.subject)).toContain("Due today");

		const week = await activities.tasks(a.agencyId, "agent", agentOne, {
			...LIST,
			window: "week",
		});
		expect(week.rows.map((row) => row.subject)).toContain("Due today");
	});

	it("forbids an agent who is not the assignee from completing a task", async () => {
		const task = await activities.create(
			a.agencyId,
			{
				type: "TASK",
				subject: "Only agent one may close this",
				customerId: a.customerId,
				assignedToId: agentOne,
			},
			a.ownerUserId,
		);

		await expect(
			activities.complete(a.agencyId, "agent", agentTwo, task.id, true),
		).rejects.toThrow();

		await expect(
			activities.complete(a.agencyId, "agent", agentOne, task.id, true),
		).resolves.toBeDefined();
	});
});
