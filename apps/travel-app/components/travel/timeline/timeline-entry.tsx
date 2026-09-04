"use client";

import { Checkbox } from "@crm/ui/components/checkbox";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { LocalDateTime, LocalRelativeTime } from "@/components/local-date-time";
import { activityLabel } from "@/components/travel/activity-presentation";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ActivityIcon } from "./activity-icon";

export type TimelineEntryData =
	RouterOutputs["activities"]["timeline"]["entries"][number];

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
	hour: "numeric",
	minute: "2-digit",
};

export function TimelineEntry({ entry }: { entry: TimelineEntryData }) {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const complete = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => cache.activity(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const isTask = entry.type === "TASK";
	const done = entry.completedAt !== null;
	const overdue =
		isTask &&
		!done &&
		entry.dueAt !== null &&
		new Date(entry.dueAt) < new Date();

	const when = entry.occurredAt ?? entry.createdAt;
	const headline = entry.subject;

	const footnotes = Boolean(
		(isTask && entry.assignedTo) || (isTask && !done && entry.dueAt),
	);

	return (
		<li className="flex gap-2.5 py-2">
			<span className="mt-0.5 shrink-0 text-muted-foreground">
				{isTask ? (
					<Checkbox
						checked={done}
						disabled={complete.isPending}
						aria-label={done ? "Mark as not done" : "Mark as done"}
						onCheckedChange={(checked) =>
							complete.mutate({ id: entry.id, completed: checked === true })
						}
					/>
				) : (
					<span role="img" aria-label={activityLabel(entry.type)}>
						<ActivityIcon type={entry.type} />
					</span>
				)}
			</span>

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-baseline gap-3">
					<div className="min-w-0 flex-1 space-y-0.5">
						{headline ? (
							<p
								className={cn(
									"wrap-anywhere font-medium",
									done && "text-muted-foreground line-through",
								)}
							>
								{headline}
							</p>
						) : null}

						{entry.body ? (
							<p
								className={cn(
									"whitespace-pre-wrap text-pretty wrap-anywhere",
									headline && "text-muted-foreground",
								)}
							>
								{entry.body}
							</p>
						) : null}

						{!headline && !entry.body ? (
							<p className="text-muted-foreground">
								{activityLabel(entry.type)}
							</p>
						) : null}
					</div>

					<span className="shrink-0 text-muted-foreground">
						<span className="hidden sm:inline">{entry.createdBy.name} · </span>
						<span className="tabular-nums">
							<LocalDateTime date={when} options={TIME_OPTIONS} />
						</span>
					</span>
				</div>

				{footnotes ? (
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
						{isTask && !done && entry.dueAt ? (
							<StatusIndicator
								tone={overdue ? "error" : "info"}
								label={
									<>
										{overdue ? "Overdue" : "Due"}{" "}
										<LocalRelativeTime date={entry.dueAt} />
									</>
								}
							/>
						) : null}

						{isTask && entry.assignedTo ? (
							<span>Assigned to {entry.assignedTo.name}</span>
						) : null}
					</div>
				) : null}
			</div>
		</li>
	);
}
