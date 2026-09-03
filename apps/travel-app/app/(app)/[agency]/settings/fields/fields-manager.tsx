"use client";

import Add from "@carbon/icons-react/es/Add";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@crm/ui/components/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { SortableItem, SortableList } from "@crm/ui/components/sortable-list";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FieldEntityName } from "@travel/db/fields-shape";
import { useState } from "react";
import { toast } from "sonner";
import { kindOf } from "@/components/travel/fields/fields-entity";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { FieldEditorSheet } from "./field-editor-sheet";

type Field = RouterOutputs["fields"]["list"][number];

const ROW = "flex items-center gap-2.5 border-b px-4 py-2.5";

function summaryOf(field: Field): string {
	const parts: string[] = [];
	if (field.required) parts.push("required");
	if (field.options.length > 0) {
		parts.push(`${field.options.length} options`);
	}
	if (field.showOnTable) parts.push("on the table");
	if (field.showOnFilter) parts.push("a filter");
	return parts.length > 0 ? parts.join(" · ") : "on the record sheet";
}

export function FieldsManager({ entity }: { entity: FieldEntityName }) {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const [editing, setEditing] = useState<Field | null>(null);
	const [creating, setCreating] = useState(false);

	const profile = useQuery(trpc.agency.profile.queryOptions());
	const query = useQuery(
		trpc.fields.list.queryOptions({ entity, includeArchived: true }),
	);

	const settle = () => cache.fields(kindOf(entity));

	const reorder = useMutation(
		trpc.fields.reorder.mutationOptions({
			onSuccess: settle,
			onError: (error) => toast.error(error.message),
		}),
	);

	const archive = useMutation(
		trpc.fields.archive.mutationOptions({
			onSuccess: settle,
			onError: (error) => toast.error(error.message),
		}),
	);

	const restore = useMutation(
		trpc.fields.restore.mutationOptions({
			onSuccess: settle,
			onError: (error) => toast.error(error.message),
		}),
	);

	const canManage = profile.data?.canManage ?? false;
	const all = query.data ?? [];
	const live = all.filter((field) => !field.archived);
	const archived = all.filter((field) => field.archived);

	return (
		<>
			<Card className="min-h-0">
				<CardHeader>
					<CardTitle>Fields</CardTitle>
					<CardDescription>
						{canManage
							? "Drag to reorder. The order is how they show on the record sheet."
							: "Only an owner or an admin can change fields."}
					</CardDescription>
					{canManage ? (
						<CardAction>
							<Button size="sm" onClick={() => setCreating(true)}>
								<Icon icon={Add} data-icon="inline-start" />
								New field
							</Button>
						</CardAction>
					) : null}
				</CardHeader>

				{query.isPending ? (
					<div className="flex items-center justify-center py-10">
						<Spinner />
					</div>
				) : live.length === 0 ? (
					<CardTableEmpty>
						No custom fields on these records yet.
					</CardTableEmpty>
				) : (
					<SortableList
						ids={live.map((field) => field.id)}
						onReorder={(ids) => {
							if (canManage) reorder.mutate({ entity, ids });
						}}
					>
						{live.map((field) => (
							<SortableItem
								key={field.id}
								id={field.id}
								label={field.label}
								className={ROW}
							>
								<button
									type="button"
									onClick={() => canManage && setEditing(field)}
									disabled={!canManage}
									className="flex min-w-0 flex-1 flex-col gap-px text-left"
								>
									<span className="w-full truncate font-medium text-sm">
										{field.label}
									</span>
									<span className="w-full truncate text-muted-foreground text-xs">
										{summaryOf(field)}
									</span>
								</button>

								<Badge variant="mono" className="w-20 shrink-0 justify-center">
									{field.typeLabel}
								</Badge>

								{canManage ? (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon-xs">
												<Icon icon={OverflowMenuVertical} />
												<span className="sr-only">More for {field.label}</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => setEditing(field)}>
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem
												onSelect={() => archive.mutate({ id: field.id })}
											>
												Archive
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								) : null}
							</SortableItem>
						))}
					</SortableList>
				)}

				{archived.length > 0 ? (
					<Collapsible>
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-muted-foreground text-xs"
							>
								{archived.length} archived
							</button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<ul className="border-t">
								{archived.map((field) => (
									<li
										key={field.id}
										className="flex items-center gap-2.5 border-b px-4 py-2"
									>
										<span className="flex-1 truncate text-muted-foreground text-xs">
											{field.label}
										</span>
										{canManage ? (
											<Button
												variant="outline"
												size="xs"
												onClick={() => restore.mutate({ id: field.id })}
											>
												Restore
											</Button>
										) : null}
									</li>
								))}
							</ul>
						</CollapsibleContent>
					</Collapsible>
				) : null}
			</Card>

			{creating ? (
				<FieldEditorSheet
					entity={entity}
					field={null}
					onClose={() => setCreating(false)}
				/>
			) : null}

			{editing ? (
				<FieldEditorSheet
					entity={entity}
					field={editing}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</>
	);
}
