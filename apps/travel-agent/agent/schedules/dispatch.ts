import { defineSchedule } from "eve/schedules";
import travel from "../channels/travel";
import { brief, drainAll, taskAuth } from "../lib/dispatch";

export default defineSchedule({
	cron: "*/10 * * * *",
	async run({ receive, waitUntil, appAuth }) {
		waitUntil(
			drainAll((task) =>
				receive(travel, {
					message: brief(task),
					target: { taskId: task.id },
					auth: taskAuth(task, appAuth),
				}),
			),
		);
	},
});
