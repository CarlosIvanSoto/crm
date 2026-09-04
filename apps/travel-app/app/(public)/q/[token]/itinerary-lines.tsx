import { formatAmount } from "@crm/ui/lib/format";
import { readItineraryDetails } from "@travel/validation/itinerary-item";
import { LocalDay } from "@/components/local-date-time";
import { itemTypeLabel } from "@/components/travel/itinerary/types";
import type { RouterOutputs } from "@/lib/trpc/types";

type PublicOption = RouterOutputs["publicQuote"]["view"]["options"][number];
type PublicItem = PublicOption["items"][number];

function detailLine(item: PublicItem): string | null {
	const details = readItineraryDetails(item.details);
	switch (details.type) {
		case "FLIGHT":
			return `${details.airline} ${details.flightNumber} · ${details.departureAirport} → ${details.arrivalAirport}`;
		case "HOTEL":
			return `${details.hotelName}${details.roomType ? ` · ${details.roomType}` : ""}`;
		case "TRANSFER":
			return `${details.pickup} → ${details.dropoff}`;
		case "TOUR":
			return details.tourName;
		case "CRUISE":
			return `${details.shipName} · ${details.nights} nights`;
		case "INSURANCE":
			return details.planName;
		case "CAR_RENTAL":
			return `${details.company} · ${details.pickupLocation} → ${details.dropoffLocation}`;
		case "PACKAGE":
			return details.packageName;
		case "OTHER":
			return details.label;
		default:
			return null;
	}
}

export function ItineraryLines({ items }: { items: PublicItem[] }) {
	if (items.length === 0) return null;

	return (
		<ul className="divide-y divide-border">
			{items.map((item, index) => (
				<li
					// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable id in the public payload
					key={index}
					className="flex items-start justify-between gap-4 py-3"
				>
					<div className="min-w-0">
						<p className="font-medium text-sm">{itemTypeLabel(item.type)}</p>
						<p className="text-muted-foreground text-sm">
							{detailLine(item) ?? item.description ?? "—"}
						</p>
						{item.startsAt ? (
							<p className="text-muted-foreground text-xs">
								<LocalDay date={item.startsAt} />
								{item.endsAt ? (
									<>
										{" – "}
										<LocalDay date={item.endsAt} />
									</>
								) : null}
							</p>
						) : null}
					</div>
					<p className="whitespace-nowrap text-sm">
						{item.sellAmount !== null && item.sellCurrency
							? formatAmount(item.sellAmount, item.sellCurrency)
							: "Price on request"}
					</p>
				</li>
			))}
		</ul>
	);
}
