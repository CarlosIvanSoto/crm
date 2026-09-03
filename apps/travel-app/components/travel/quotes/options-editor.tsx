"use client";

import Add from "@carbon/icons-react/es/Add";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { useId } from "react";
import { ItemsEditor } from "@/components/travel/itinerary/items-editor";
import {
	draftKey,
	type ItineraryDraft,
} from "@/components/travel/itinerary/types";

export type QuoteOptionDraft = {
	key: string;
	id: string | null;
	label: string;
	isRecommended: boolean;
	items: ItineraryDraft[];
};

export function newOption(): QuoteOptionDraft {
	return {
		key: draftKey(),
		id: null,
		label: "",
		isRecommended: false,
		items: [],
	};
}

type SupplierOption = { id: string; name: string };

type Props = {
	options: QuoteOptionDraft[];
	onChange: (next: QuoteOptionDraft[]) => void;
	suppliers: SupplierOption[];
};

export function OptionsEditor({ options, onChange, suppliers }: Props) {
	const id = useId();

	const patch = (key: string, next: Partial<QuoteOptionDraft>) =>
		onChange(
			options.map((option) =>
				option.key === key ? { ...option, ...next } : option,
			),
		);

	return (
		<div className="space-y-4">
			{options.map((option, index) => (
				<div key={option.key} className="space-y-3 rounded-lg border p-3">
					<div className="flex items-end gap-2">
						<Field>
							<FieldLabel htmlFor={`${id}-${option.key}-label`}>
								Option {index + 1}
							</FieldLabel>
							<Input
								id={`${id}-${option.key}-label`}
								value={option.label}
								placeholder="Beach and reef"
								onChange={(event) =>
									patch(option.key, { label: event.target.value })
								}
							/>
						</Field>
						<Field orientation="horizontal" className="pb-2">
							<Checkbox
								id={`${id}-${option.key}-rec`}
								checked={option.isRecommended}
								onCheckedChange={(checked) =>
									patch(option.key, { isRecommended: checked === true })
								}
							/>
							<FieldLabel htmlFor={`${id}-${option.key}-rec`}>
								Recommended
							</FieldLabel>
						</Field>
						<Button
							variant="ghost"
							size="icon-sm"
							disabled={options.length <= 1}
							onClick={() =>
								onChange(options.filter((entry) => entry.key !== option.key))
							}
						>
							<TrashCan />
							<span className="sr-only">Remove option</span>
						</Button>
					</div>

					<ItemsEditor
						items={option.items}
						onChange={(items) => patch(option.key, { items })}
						suppliers={suppliers}
					/>
				</div>
			))}

			<Button
				variant="outline"
				size="sm"
				onClick={() => onChange([...options, newOption()])}
			>
				<Add data-icon="inline-start" />
				Add option
			</Button>
		</div>
	);
}
