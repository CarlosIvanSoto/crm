"use client";

import Add from "@carbon/icons-react/es/Add";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useId } from "react";
import { isoToDateInput } from "@/lib/date-input";
import { DetailsFields } from "./details-fields";
import {
	emptyDetails,
	ITEM_STATUSES,
	ITEM_TYPES,
	type ItineraryDraft,
	type ItineraryItemType,
	newDraft,
} from "./types";

const NO_SUPPLIER = "none";

type SupplierOption = { id: string; name: string };

type Props = {
	items: ItineraryDraft[];
	onChange: (next: ItineraryDraft[]) => void;
	suppliers: SupplierOption[];
};

function numberOrNull(value: string): number | null {
	if (value.trim() === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function currencyOrNull(value: string): string | null {
	const code = value.trim().toUpperCase();
	return code.length === 3 ? code : null;
}

function dateStartOfDay(value: string): string | null {
	if (!value) return null;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function ItemsEditor({ items, onChange, suppliers }: Props) {
	const id = useId();

	const patch = (key: string, next: Partial<ItineraryDraft>) =>
		onChange(
			items.map((item) => (item.key === key ? { ...item, ...next } : item)),
		);

	return (
		<div className="space-y-3">
			{items.length === 0 ? (
				<p className="text-muted-foreground text-sm">No lines yet.</p>
			) : null}

			{items.map((item, index) => (
				<div key={item.key} className="space-y-2 rounded-lg border p-3">
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground text-xs tabular-nums">
							{index + 1}
						</span>
						<Select
							value={item.type}
							onValueChange={(value) => {
								const type = value as ItineraryItemType;
								patch(item.key, { type, details: emptyDetails(type) });
							}}
						>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ITEM_TYPES.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={item.status}
							onValueChange={(value) =>
								patch(item.key, {
									status: value as ItineraryDraft["status"],
								})
							}
						>
							<SelectTrigger className="w-36">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ITEM_STATUSES.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							variant="ghost"
							size="icon-sm"
							className="ml-auto"
							onClick={() =>
								onChange(items.filter((entry) => entry.key !== item.key))
							}
						>
							<TrashCan />
							<span className="sr-only">Remove line</span>
						</Button>
					</div>

					<DetailsFields
						details={item.details}
						onChange={(details) => patch(item.key, { details })}
					/>

					<div className="grid grid-cols-2 gap-2">
						<Field>
							<FieldLabel htmlFor={`${id}-${item.key}-supplier`}>
								Supplier
							</FieldLabel>
							<Select
								value={item.supplierId ?? NO_SUPPLIER}
								onValueChange={(value) =>
									patch(item.key, {
										supplierId: value === NO_SUPPLIER ? null : value,
									})
								}
							>
								<SelectTrigger id={`${id}-${item.key}-supplier`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_SUPPLIER}>No supplier</SelectItem>
									{suppliers.map((supplier) => (
										<SelectItem key={supplier.id} value={supplier.id}>
											{supplier.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${item.key}-pax`}>Pax</FieldLabel>
							<Input
								id={`${id}-${item.key}-pax`}
								type="number"
								min={1}
								value={item.paxCount}
								onChange={(event) =>
									patch(item.key, {
										paxCount: numberOrNull(event.target.value) ?? 1,
									})
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${item.key}-starts`}>
								Starts
							</FieldLabel>
							<Input
								id={`${id}-${item.key}-starts`}
								type="date"
								value={isoToDateInput(item.startsAt)}
								onChange={(event) =>
									patch(item.key, {
										startsAt: dateStartOfDay(event.target.value),
									})
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${item.key}-ends`}>Ends</FieldLabel>
							<Input
								id={`${id}-${item.key}-ends`}
								type="date"
								value={isoToDateInput(item.endsAt)}
								onChange={(event) =>
									patch(item.key, {
										endsAt: dateStartOfDay(event.target.value),
									})
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${item.key}-cost`}>Cost</FieldLabel>
							<div className="flex gap-2">
								<Input
									id={`${id}-${item.key}-cost`}
									type="number"
									min={0}
									step="0.01"
									value={item.costAmount ?? ""}
									onChange={(event) =>
										patch(item.key, {
											costAmount: numberOrNull(event.target.value),
										})
									}
								/>
								<Input
									aria-label="Cost currency"
									className="w-20"
									maxLength={3}
									placeholder="USD"
									value={item.costCurrency ?? ""}
									onChange={(event) =>
										patch(item.key, {
											costCurrency: currencyOrNull(event.target.value),
										})
									}
								/>
							</div>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${item.key}-sell`}>Sell</FieldLabel>
							<div className="flex gap-2">
								<Input
									id={`${id}-${item.key}-sell`}
									type="number"
									min={0}
									step="0.01"
									value={item.sellAmount ?? ""}
									onChange={(event) =>
										patch(item.key, {
											sellAmount: numberOrNull(event.target.value),
										})
									}
								/>
								<Input
									aria-label="Sell currency"
									className="w-20"
									maxLength={3}
									placeholder="USD"
									value={item.sellCurrency ?? ""}
									onChange={(event) =>
										patch(item.key, {
											sellCurrency: currencyOrNull(event.target.value),
										})
									}
								/>
							</div>
						</Field>
					</div>

					<Field>
						<FieldLabel htmlFor={`${id}-${item.key}-desc`}>
							Description
						</FieldLabel>
						<Input
							id={`${id}-${item.key}-desc`}
							value={item.description ?? ""}
							onChange={(event) =>
								patch(item.key, {
									description: event.target.value || null,
								})
							}
						/>
					</Field>
				</div>
			))}

			<Button
				variant="outline"
				size="sm"
				onClick={() => onChange([...items, newDraft("OTHER")])}
			>
				<Add data-icon="inline-start" />
				Add line
			</Button>
		</div>
	);
}
