"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldTitle,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { useMutation } from "@tanstack/react-query";
import {
	FIELD_TYPES,
	type FieldEntityName,
	type FieldTypeName,
	fieldKeyFromLabel,
	typeLabel,
	usesOptions,
} from "@travel/db/fields-shape";
import { useId, useState } from "react";
import { toast } from "sonner";
import { kindOf } from "@/components/travel/fields/fields-entity";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type FieldRow = RouterOutputs["fields"]["list"][number];

type Draft = {
	label: string;
	type: FieldTypeName;
	options: { id?: string; label: string }[];
	required: boolean;
	showOnSheet: boolean;
	showOnTable: boolean;
	showOnFilter: boolean;
};

function draftFrom(field: FieldRow | null): Draft {
	return {
		label: field?.label ?? "",
		type: field?.type ?? "TEXT",
		options:
			field?.options.map((option) => ({
				id: option.id,
				label: option.label,
			})) ?? [],
		required: field?.required ?? false,
		showOnSheet: field?.showOnSheet ?? true,
		showOnTable: field?.showOnTable ?? false,
		showOnFilter: field?.showOnFilter ?? false,
	};
}

function optionKey(option: { id?: string }, index: number): string {
	return option.id ?? `draft-${index}`;
}

function filterableType(type: FieldTypeName): boolean {
	return type === "SELECT" || type === "USER";
}

export function FieldEditorSheet({
	entity,
	field,
	onClose,
}: {
	entity: FieldEntityName;
	field: FieldRow | null;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const labelId = useId();
	const typeId = useId();

	const [draft, setDraft] = useState<Draft>(() => draftFrom(field));
	const patch = (next: Partial<Draft>) =>
		setDraft((current) => ({ ...current, ...next }));

	const settle = async () => {
		await cache.fields(kindOf(entity));
		onClose();
	};

	const create = useMutation(
		trpc.fields.create.mutationOptions({
			onSuccess: settle,
			onError: (error) => toast.error(error.message),
		}),
	);

	const update = useMutation(
		trpc.fields.update.mutationOptions({
			onSuccess: settle,
			onError: (error) => toast.error(error.message),
		}),
	);

	const saving = create.isPending || update.isPending;
	const key = field?.key ?? fieldKeyFromLabel(draft.label);
	const filterable = filterableType(draft.type);

	const save = () => {
		const options = draft.options
			.filter((option) => option.label.trim() !== "")
			.map((option) => ({ id: option.id, label: option.label.trim() }));

		const payload = {
			label: draft.label.trim(),
			type: draft.type,
			options,
			required: draft.required,
			showOnSheet: draft.showOnSheet,
			showOnTable: draft.showOnTable,
			showOnFilter: filterable && draft.showOnFilter,
		};

		if (field) {
			update.mutate({ id: field.id, data: payload });
			return;
		}
		create.mutate({ ...payload, entity });
	};

	return (
		<Sheet open onOpenChange={(next) => (next ? undefined : onClose())}>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>{field ? "Edit field" : "New field"}</SheetTitle>
					<SheetDescription>
						{field
							? "The key never changes once a field exists."
							: "The key is derived from the label."}
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-4">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={labelId}>Label</FieldLabel>
							<Input
								id={labelId}
								value={draft.label}
								onChange={(event) => patch({ label: event.target.value })}
							/>
						</Field>

						<Field>
							<div className="flex items-baseline justify-between gap-2">
								<FieldTitle>Key</FieldTitle>
								<span className="font-mono text-muted-foreground text-xs">
									{key || "—"}
								</span>
							</div>
						</Field>

						<Field>
							<FieldLabel htmlFor={typeId}>Type</FieldLabel>
							<Select
								value={draft.type}
								disabled={Boolean(field)}
								onValueChange={(value) =>
									patch({ type: value as FieldTypeName })
								}
							>
								<SelectTrigger id={typeId} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{FIELD_TYPES.map((type) => (
										<SelectItem key={type} value={type}>
											{typeLabel(type)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{field ? (
								<FieldDescription>
									A field's type is fixed after it is created.
								</FieldDescription>
							) : null}
						</Field>

						{usesOptions(draft.type) ? (
							<Field>
								<FieldTitle>Options</FieldTitle>
								<div className="flex flex-col gap-1.5">
									{draft.options.map((option, index) => (
										<div
											key={optionKey(option, index)}
											className="flex items-center gap-1.5"
										>
											<Input
												aria-label={`Option ${index + 1}`}
												value={option.label}
												onChange={(event) =>
													patch({
														options: draft.options.map((entry, at) =>
															at === index
																? { ...entry, label: event.target.value }
																: entry,
														),
													})
												}
											/>
											<Button
												variant="ghost"
												size="icon-xs"
												onClick={() =>
													patch({
														options: draft.options.filter(
															(_, at) => at !== index,
														),
													})
												}
											>
												<Icon icon={Close} />
												<span className="sr-only">
													Remove option {index + 1}
												</span>
											</Button>
										</div>
									))}
								</div>
								<Button
									variant="ghost"
									size="sm"
									className="self-start"
									onClick={() =>
										patch({ options: [...draft.options, { label: "" }] })
									}
								>
									<Icon icon={Add} data-icon="inline-start" />
									Add option
								</Button>
							</Field>
						) : null}

						<Field orientation="horizontal">
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<FieldLabel>Required</FieldLabel>
								<FieldDescription>
									The record cannot be saved without it.
								</FieldDescription>
							</div>
							<Switch
								checked={draft.required}
								onCheckedChange={(required) => patch({ required })}
							/>
						</Field>

						<div className="flex flex-col gap-2.5">
							<FieldLabel className="items-center gap-2 font-normal">
								<Checkbox
									checked={draft.showOnSheet}
									onCheckedChange={(checked) =>
										patch({ showOnSheet: checked === true })
									}
								/>
								Show on the record sheet
							</FieldLabel>
							<FieldLabel className="items-center gap-2 font-normal">
								<Checkbox
									checked={draft.showOnTable}
									onCheckedChange={(checked) =>
										patch({ showOnTable: checked === true })
									}
								/>
								Show as a table column
							</FieldLabel>
							{filterable ? (
								<FieldLabel className="items-center gap-2 font-normal">
									<Checkbox
										checked={draft.showOnFilter}
										onCheckedChange={(checked) =>
											patch({ showOnFilter: checked === true })
										}
									/>
									Offer as a filter
								</FieldLabel>
							) : null}
						</div>
					</FieldGroup>
				</div>

				<SheetFooter>
					<Button disabled={saving || draft.label.trim() === ""} onClick={save}>
						{saving ? <Spinner data-icon="inline-start" /> : null}
						{field ? "Save" : "Add field"}
					</Button>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
