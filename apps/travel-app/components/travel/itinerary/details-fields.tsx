"use client";

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
import type { ItineraryDetails } from "@travel/validation/itinerary-item";
import { useId } from "react";

type Props = {
	details: ItineraryDetails;
	onChange: (next: ItineraryDetails) => void;
};

function numberOrNull(value: string): number | null {
	if (value.trim() === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: string): string | null {
	return value.trim() === "" ? null : value;
}

export function DetailsFields({ details, onChange }: Props) {
	const id = useId();
	const grid = "grid grid-cols-2 gap-2";

	if (details.type === "FLIGHT") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-airline`}>Airline</FieldLabel>
					<Input
						id={`${id}-airline`}
						value={details.airline}
						onChange={(event) =>
							onChange({ ...details, airline: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-flight`}>Flight number</FieldLabel>
					<Input
						id={`${id}-flight`}
						value={details.flightNumber}
						onChange={(event) =>
							onChange({ ...details, flightNumber: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-cabin`}>Cabin</FieldLabel>
					<Select
						value={details.cabin}
						onValueChange={(value) =>
							onChange({
								...details,
								cabin: value as typeof details.cabin,
							})
						}
					>
						<SelectTrigger id={`${id}-cabin`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ECONOMY">Economy</SelectItem>
							<SelectItem value="PREMIUM">Premium</SelectItem>
							<SelectItem value="BUSINESS">Business</SelectItem>
							<SelectItem value="FIRST">First</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-baggage`}>Baggage</FieldLabel>
					<Input
						id={`${id}-baggage`}
						value={details.baggage ?? ""}
						onChange={(event) =>
							onChange({ ...details, baggage: textOrNull(event.target.value) })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-dep`}>From (IATA)</FieldLabel>
					<Input
						id={`${id}-dep`}
						value={details.departureAirport}
						maxLength={3}
						onChange={(event) =>
							onChange({
								...details,
								departureAirport: event.target.value.toUpperCase(),
							})
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-arr`}>To (IATA)</FieldLabel>
					<Input
						id={`${id}-arr`}
						value={details.arrivalAirport}
						maxLength={3}
						onChange={(event) =>
							onChange({
								...details,
								arrivalAirport: event.target.value.toUpperCase(),
							})
						}
					/>
				</Field>
			</div>
		);
	}

	if (details.type === "HOTEL") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-hotel`}>Hotel</FieldLabel>
					<Input
						id={`${id}-hotel`}
						value={details.hotelName}
						onChange={(event) =>
							onChange({ ...details, hotelName: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-room`}>Room type</FieldLabel>
					<Input
						id={`${id}-room`}
						value={details.roomType}
						onChange={(event) =>
							onChange({ ...details, roomType: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-meal`}>Meal plan</FieldLabel>
					<Select
						value={details.mealPlan}
						onValueChange={(value) =>
							onChange({
								...details,
								mealPlan: value as typeof details.mealPlan,
							})
						}
					>
						<SelectTrigger id={`${id}-meal`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ROOM_ONLY">Room only</SelectItem>
							<SelectItem value="BREAKFAST">Breakfast</SelectItem>
							<SelectItem value="HALF">Half board</SelectItem>
							<SelectItem value="FULL">Full board</SelectItem>
							<SelectItem value="ALL_INCLUSIVE">All inclusive</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-nights`}>Nights</FieldLabel>
					<Input
						id={`${id}-nights`}
						type="number"
						min={1}
						value={details.nights}
						onChange={(event) =>
							onChange({
								...details,
								nights: numberOrNull(event.target.value) ?? 1,
							})
						}
					/>
				</Field>
			</div>
		);
	}

	if (details.type === "TRANSFER") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-mode`}>Mode</FieldLabel>
					<Select
						value={details.mode}
						onValueChange={(value) =>
							onChange({ ...details, mode: value as typeof details.mode })
						}
					>
						<SelectTrigger id={`${id}-mode`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="PRIVATE">Private</SelectItem>
							<SelectItem value="SHARED">Shared</SelectItem>
							<SelectItem value="SHUTTLE">Shuttle</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-vehicle`}>Vehicle</FieldLabel>
					<Input
						id={`${id}-vehicle`}
						value={details.vehicle ?? ""}
						onChange={(event) =>
							onChange({ ...details, vehicle: textOrNull(event.target.value) })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-pickup`}>Pickup</FieldLabel>
					<Input
						id={`${id}-pickup`}
						value={details.pickup}
						onChange={(event) =>
							onChange({ ...details, pickup: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-dropoff`}>Dropoff</FieldLabel>
					<Input
						id={`${id}-dropoff`}
						value={details.dropoff}
						onChange={(event) =>
							onChange({ ...details, dropoff: event.target.value })
						}
					/>
				</Field>
			</div>
		);
	}

	if (details.type === "TOUR") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-tour`}>Tour</FieldLabel>
					<Input
						id={`${id}-tour`}
						value={details.tourName}
						onChange={(event) =>
							onChange({ ...details, tourName: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-hours`}>Duration (hours)</FieldLabel>
					<Input
						id={`${id}-hours`}
						type="number"
						min={0.5}
						step={0.5}
						value={details.durationHours ?? ""}
						onChange={(event) =>
							onChange({
								...details,
								durationHours: numberOrNull(event.target.value),
							})
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-lang`}>Guide language</FieldLabel>
					<Input
						id={`${id}-lang`}
						value={details.guideLanguage ?? ""}
						onChange={(event) =>
							onChange({
								...details,
								guideLanguage: textOrNull(event.target.value),
							})
						}
					/>
				</Field>
				<Field orientation="horizontal">
					<Checkbox
						id={`${id}-private`}
						checked={details.isPrivate}
						onCheckedChange={(checked) =>
							onChange({ ...details, isPrivate: checked === true })
						}
					/>
					<FieldLabel htmlFor={`${id}-private`}>Private tour</FieldLabel>
				</Field>
			</div>
		);
	}

	if (details.type === "CRUISE") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-ship`}>Ship</FieldLabel>
					<Input
						id={`${id}-ship`}
						value={details.shipName}
						onChange={(event) =>
							onChange({ ...details, shipName: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-cabin-cat`}>Cabin</FieldLabel>
					<Select
						value={details.cabinCategory}
						onValueChange={(value) =>
							onChange({
								...details,
								cabinCategory: value as typeof details.cabinCategory,
							})
						}
					>
						<SelectTrigger id={`${id}-cabin-cat`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="INTERIOR">Interior</SelectItem>
							<SelectItem value="OCEAN_VIEW">Ocean view</SelectItem>
							<SelectItem value="BALCONY">Balcony</SelectItem>
							<SelectItem value="SUITE">Suite</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-cruise-nights`}>Nights</FieldLabel>
					<Input
						id={`${id}-cruise-nights`}
						type="number"
						min={1}
						value={details.nights}
						onChange={(event) =>
							onChange({
								...details,
								nights: numberOrNull(event.target.value) ?? 1,
							})
						}
					/>
				</Field>
			</div>
		);
	}

	if (details.type === "INSURANCE") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-plan`}>Plan</FieldLabel>
					<Input
						id={`${id}-plan`}
						value={details.planName}
						onChange={(event) =>
							onChange({ ...details, planName: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-coverage`}>Coverage</FieldLabel>
					<Input
						id={`${id}-coverage`}
						value={details.coverage}
						onChange={(event) =>
							onChange({ ...details, coverage: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-policy`}>Policy number</FieldLabel>
					<Input
						id={`${id}-policy`}
						value={details.policyNumber ?? ""}
						onChange={(event) =>
							onChange({
								...details,
								policyNumber: textOrNull(event.target.value),
							})
						}
					/>
				</Field>
			</div>
		);
	}

	if (details.type === "CAR_RENTAL") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-company`}>Company</FieldLabel>
					<Input
						id={`${id}-company`}
						value={details.company}
						onChange={(event) =>
							onChange({ ...details, company: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-class`}>Car class</FieldLabel>
					<Input
						id={`${id}-class`}
						value={details.carClass}
						onChange={(event) =>
							onChange({ ...details, carClass: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-pickup-loc`}>Pickup</FieldLabel>
					<Input
						id={`${id}-pickup-loc`}
						value={details.pickupLocation}
						onChange={(event) =>
							onChange({ ...details, pickupLocation: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-dropoff-loc`}>Dropoff</FieldLabel>
					<Input
						id={`${id}-dropoff-loc`}
						value={details.dropoffLocation}
						onChange={(event) =>
							onChange({ ...details, dropoffLocation: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-transmission`}>Transmission</FieldLabel>
					<Select
						value={details.transmission}
						onValueChange={(value) =>
							onChange({
								...details,
								transmission: value as typeof details.transmission,
							})
						}
					>
						<SelectTrigger id={`${id}-transmission`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="AUTOMATIC">Automatic</SelectItem>
							<SelectItem value="MANUAL">Manual</SelectItem>
						</SelectContent>
					</Select>
				</Field>
			</div>
		);
	}

	if (details.type === "PACKAGE") {
		return (
			<div className={grid}>
				<Field>
					<FieldLabel htmlFor={`${id}-package`}>Package</FieldLabel>
					<Input
						id={`${id}-package`}
						value={details.packageName}
						onChange={(event) =>
							onChange({ ...details, packageName: event.target.value })
						}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-inclusions`}>Inclusions</FieldLabel>
					<Input
						id={`${id}-inclusions`}
						value={details.inclusions}
						onChange={(event) =>
							onChange({ ...details, inclusions: event.target.value })
						}
					/>
				</Field>
			</div>
		);
	}

	return (
		<div className={grid}>
			<Field>
				<FieldLabel htmlFor={`${id}-label`}>Label</FieldLabel>
				<Input
					id={`${id}-label`}
					value={details.label}
					onChange={(event) =>
						onChange({ ...details, label: event.target.value })
					}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${id}-notes`}>Notes</FieldLabel>
				<Input
					id={`${id}-notes`}
					value={details.notes ?? ""}
					onChange={(event) =>
						onChange({ ...details, notes: textOrNull(event.target.value) })
					}
				/>
			</Field>
		</div>
	);
}
