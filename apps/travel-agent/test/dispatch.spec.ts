import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import { claimDue, completeTask, retireExhausted } from "../agent/lib/tasks";

const kind = "test-lease";
const suffix = process.env.TEST_RUN_ID ?? "travel-agent-dispatch-spec";
const agencyId = `${suffix}-agency`;

beforeAll(async () => {
	await db.organization.create({
		data: {
			id: agencyId,
			name: agencyId,
			slug: agencyId,
			createdAt: new Date(),
		},
	});
});

afterEach(async () => {
	await db.agentTask.deleteMany({ where: { agencyId, kind } });
});

afterAll(async () => {
	await db.organization.deleteMany({ where: { id: agencyId } });
	await db.$disconnect();
});

async function queue(
	overrides: { priority?: number; dueAt?: Date } = {},
): Promise<{ id: string }> {
	return db.agentTask.create({
		data: {
			agencyId,
			kind,
			reason: "test",
			dueAt: overrides.dueAt ?? new Date(Date.now() - 1000),
			priority: overrides.priority ?? 0,
			budget: 4,
		},
		select: { id: true },
	});
}

async function expire(taskId: string): Promise<void> {
	await db.agentTask.update({
		where: { id: taskId },
		data: { leasedUntil: new Date(Date.now() - 1000) },
	});
}

describe("claimDue", () => {
	it("claims due work and leases it", async () => {
		const task = await queue();

		const claimed = await claimDue(10);
		expect(claimed.map((row) => row.id)).toContain(task.id);

		const row = await db.agentTask.findUnique({ where: { id: task.id } });
		expect(row?.leasedUntil).not.toBeNull();
		expect(row?.startedAt).not.toBeNull();
	});

	it("does not hand the same row to two dispatchers in parallel", async () => {
		await Promise.all([queue(), queue(), queue()]);

		const [first, second] = await Promise.all([claimDue(3), claimDue(3)]);
		const ids = [...first, ...second]
			.filter((row) => row.kind === kind)
			.map((row) => row.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	it("leaves work that is not due yet", async () => {
		await queue({ dueAt: new Date(Date.now() + 60_000) });
		const claimed = await claimDue(10);
		expect(claimed.some((row) => row.kind === kind)).toBe(false);
	});

	it("takes the most urgent first", async () => {
		const low = await queue({ priority: 0 });
		const high = await queue({ priority: 100 });

		const claimed = await claimDue(1);
		expect(claimed[0]?.id).toBe(high.id);

		await expire(low.id);
	});

	it("releases a claimed row once its lease expires", async () => {
		const task = await queue();

		await claimDue(10, 100);
		await expire(task.id);

		const reclaimed = await claimDue(10);
		expect(reclaimed.map((row) => row.id)).toContain(task.id);
	});
});

describe("completeTask", () => {
	it("settles an open task and reports its subject", async () => {
		const task = await queue();

		const subject = await completeTask(task.id, "ran");
		expect(subject?.id).toBe(task.id);

		const row = await db.agentTask.findUnique({ where: { id: task.id } });
		expect(row?.finishedAt).not.toBeNull();
		expect(row?.outcome).toBe("ran");
	});

	it("returns null for a task that is already finished", async () => {
		const task = await queue();
		await completeTask(task.id, "ran");

		expect(await completeTask(task.id, "ran again")).toBeNull();
	});
});

describe("retireExhausted", () => {
	it("closes a row that has run out of attempts", async () => {
		const task = await queue();
		await db.agentTask.update({
			where: { id: task.id },
			data: { attempts: 999 },
		});

		const retired = await retireExhausted();
		expect(retired.map((row) => row.id)).toContain(task.id);

		const row = await db.agentTask.findUnique({ where: { id: task.id } });
		expect(row?.finishedAt).not.toBeNull();
	});
});
