import { timingSafeEqual } from "node:crypto";
import { eveTurnFailure } from "@travel/validation/eve-stream";
import { defineChannel, GET, POST } from "eve/channels";
import { z } from "zod";
import { brief, dispatchHealth, drainAll, taskAuth } from "../lib/dispatch";
import { completeTask, taskSubject } from "../lib/tasks";

const TASK_MARKER = "task:";

export function authorised(request: Request): boolean {
	const secret = process.env.TRAVEL_AGENT_BRIDGE_SECRET?.trim();
	if (!secret) return false;

	const header = request.headers.get("authorization");
	if (!header?.startsWith("Bearer ")) return false;

	const candidate = Buffer.from(header.slice("Bearer ".length));
	const expected = Buffer.from(secret);
	if (candidate.length !== expected.length) return false;

	return timingSafeEqual(candidate, expected);
}

export function taskToken(taskId: string): string {
	return `${TASK_MARKER}${taskId}`;
}

export function taskFromToken(token: string | undefined): string | null {
	if (!token) return null;

	const marker = token.lastIndexOf(TASK_MARKER);
	if (marker === -1) return null;

	const id = token.slice(marker + TASK_MARKER.length);
	return id.length > 0 ? id : null;
}

async function closeTask(
	token: string | undefined,
	outcome: string,
): Promise<boolean> {
	const taskId = taskFromToken(token);
	if (!taskId) return false;

	const completed = await completeTask(taskId, outcome);
	return completed !== null || (await taskSubject(taskId)) !== null;
}

const receiveTarget = z
	.object({ taskId: z.string().nullable().catch(null) })
	.catch({ taskId: null });

export default defineChannel({
	routes: [
		GET("/internal/travel/dispatch-health", async (request) => {
			if (!authorised(request)) {
				return new Response("Unauthorized", { status: 401 });
			}

			return Response.json(dispatchHealth());
		}),

		POST("/internal/travel/dispatch", async (request, { send, waitUntil }) => {
			if (!authorised(request)) {
				return new Response("Unauthorized", { status: 401 });
			}

			waitUntil(
				drainAll((task) =>
					send(brief(task), {
						auth: taskAuth(task),
						continuationToken: taskToken(task.id),
					}),
				),
			);

			return new Response(null, { status: 202 });
		}),
	],

	events: {
		async "session.waiting"(_data, channel) {
			await closeTask(channel.continuationToken, "ran");
		},

		async "session.completed"(_data, channel) {
			await closeTask(channel.continuationToken, "ran");
		},

		async "turn.cancelled"(_data, channel) {
			await closeTask(channel.continuationToken, "stopped");
		},

		async "turn.failed"(data, channel) {
			const message =
				eveTurnFailure.parse(data).message ?? "The agent turn failed.";
			await closeTask(channel.continuationToken, `Failed: ${message}`);
		},
	},

	async receive(input, { send }) {
		const target = receiveTarget.parse(input.target);

		return send(input.message, {
			auth: input.auth,
			continuationToken: target.taskId
				? taskToken(target.taskId)
				: `travel:adhoc:${crypto.randomUUID()}`,
		});
	},
});
