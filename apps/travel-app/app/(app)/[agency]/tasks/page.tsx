import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CreateTaskSheet } from "./create-task-sheet";
import { tasksSearchParams, toTaskListInput } from "./tasks-search-params";
import { TasksTable } from "./tasks-table";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage({
	searchParams,
}: PageProps<"/[agency]/tasks">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Tasks</PageShellTitle>
					<PageShellDescription>
						Everything the agency owes a customer an action on, by advisor.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<CreateTaskSheet />
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Tasks searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Tasks({
	searchParams,
}: Pick<PageProps<"/[agency]/tasks">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		tasksSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(
		trpc.activities.tasks.queryOptions(toTaskListInput(values)),
	);

	return (
		<HydrateClient>
			<TasksTable />
		</HydrateClient>
	);
}
