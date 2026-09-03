"use client";

import Add from "@carbon/icons-react/es/Add";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
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
import { DOCUMENT_TYPES } from "@/components/travel/document-type";
import { draftKey } from "@/components/travel/itinerary/types";
import { PAX_TYPES } from "@/components/travel/status-labels";
import { isoToDateInput } from "@/lib/date-input";

export type BookingTravelerDraft = {
	key: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string | null;
	nationality: string | null;
	documentType: string | null;
	documentNumber: string | null;
	documentExpiresAt: string | null;
	paxType: "ADULT" | "CHILD" | "INFANT";
	isLead: boolean;
};

export function newTraveler(): BookingTravelerDraft {
	return {
		key: draftKey(),
		firstName: "",
		lastName: "",
		dateOfBirth: null,
		nationality: null,
		documentType: null,
		documentNumber: null,
		documentExpiresAt: null,
		paxType: "ADULT",
		isLead: false,
	};
}

const NO_DOCUMENT = "none";

function dayIso(value: string): string | null {
	if (!value) return null;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type Props = {
	travelers: BookingTravelerDraft[];
	onChange: (next: BookingTravelerDraft[]) => void;
};

export function TravelersEditor({ travelers, onChange }: Props) {
	const id = useId();

	const patch = (key: string, next: Partial<BookingTravelerDraft>) =>
		onChange(
			travelers.map((row) => (row.key === key ? { ...row, ...next } : row)),
		);

	return (
		<div className="space-y-3">
			{travelers.length === 0 ? (
				<p className="text-muted-foreground text-sm">No travelers yet.</p>
			) : null}

			{travelers.map((row, index) => (
				<div key={row.key} className="space-y-2 rounded-lg border p-3">
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground text-xs tabular-nums">
							{index + 1}
						</span>
						<Select
							value={row.paxType}
							onValueChange={(value) =>
								patch(row.key, {
									paxType: value as BookingTravelerDraft["paxType"],
								})
							}
						>
							<SelectTrigger className="w-28">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PAX_TYPES.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Field orientation="horizontal">
							<Checkbox
								id={`${id}-${row.key}-lead`}
								checked={row.isLead}
								onCheckedChange={(checked) =>
									patch(row.key, { isLead: checked === true })
								}
							/>
							<FieldLabel htmlFor={`${id}-${row.key}-lead`}>Lead</FieldLabel>
						</Field>
						<Button
							variant="ghost"
							size="icon-sm"
							className="ml-auto"
							onClick={() =>
								onChange(travelers.filter((entry) => entry.key !== row.key))
							}
						>
							<TrashCan />
							<span className="sr-only">Remove traveler</span>
						</Button>
					</div>

					<div className="grid grid-cols-2 gap-2">
						<Field>
							<FieldLabel htmlFor={`${id}-${row.key}-first`}>First</FieldLabel>
							<Input
								id={`${id}-${row.key}-first`}
								value={row.firstName}
								onChange={(event) =>
									patch(row.key, { firstName: event.target.value })
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${row.key}-last`}>Last</FieldLabel>
							<Input
								id={`${id}-${row.key}-last`}
								value={row.lastName}
								onChange={(event) =>
									patch(row.key, { lastName: event.target.value })
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${row.key}-nat`}>
								Nationality
							</FieldLabel>
							<Input
								id={`${id}-${row.key}-nat`}
								value={row.nationality ?? ""}
								onChange={(event) =>
									patch(row.key, {
										nationality: event.target.value || null,
									})
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${row.key}-dob`}>Born</FieldLabel>
							<Input
								id={`${id}-${row.key}-dob`}
								type="date"
								value={isoToDateInput(row.dateOfBirth)}
								onChange={(event) =>
									patch(row.key, { dateOfBirth: dayIso(event.target.value) })
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${row.key}-doc-type`}>
								Document
							</FieldLabel>
							<Select
								value={row.documentType ?? NO_DOCUMENT}
								onValueChange={(value) =>
									patch(row.key, {
										documentType: value === NO_DOCUMENT ? null : value,
									})
								}
							>
								<SelectTrigger id={`${id}-${row.key}-doc-type`}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_DOCUMENT}>None</SelectItem>
									{DOCUMENT_TYPES.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${row.key}-doc-num`}>
								Doc number
							</FieldLabel>
							<Input
								id={`${id}-${row.key}-doc-num`}
								value={row.documentNumber ?? ""}
								onChange={(event) =>
									patch(row.key, {
										documentNumber: event.target.value || null,
									})
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-${row.key}-doc-exp`}>
								Doc expiry
							</FieldLabel>
							<Input
								id={`${id}-${row.key}-doc-exp`}
								type="date"
								value={isoToDateInput(row.documentExpiresAt)}
								onChange={(event) =>
									patch(row.key, {
										documentExpiresAt: dayIso(event.target.value),
									})
								}
							/>
						</Field>
					</div>
				</div>
			))}

			<Button
				variant="outline"
				size="sm"
				onClick={() => onChange([...travelers, newTraveler()])}
			>
				<Add data-icon="inline-start" />
				Add traveler
			</Button>
		</div>
	);
}
