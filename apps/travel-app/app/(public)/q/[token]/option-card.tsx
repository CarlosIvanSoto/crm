import { Badge } from "@crm/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { formatAmount } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ItineraryLines } from "./itinerary-lines";

type PublicOption = RouterOutputs["publicQuote"]["view"]["options"][number];

export function OptionCard({
	option,
	selected,
	onSelect,
}: {
	option: PublicOption;
	selected: boolean;
	onSelect?: (id: string) => void;
}) {
	return (
		<Card
			data-print="keep"
			className={cn(
				"transition-colors",
				selected && "border-primary ring-1 ring-primary",
			)}
		>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="flex items-center gap-2">
						{option.label}
						{option.isRecommended ? <Badge>Recommended</Badge> : null}
					</CardTitle>
					<div className="text-right">
						<p className="font-semibold text-lg">
							{option.priced &&
							option.sellTotalBase !== null &&
							option.baseCurrency
								? formatAmount(option.sellTotalBase, option.baseCurrency)
								: "Price on request"}
						</p>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<ItineraryLines items={option.items} />
				{onSelect ? (
					<button
						type="button"
						data-print="hide"
						onClick={() => onSelect(option.id)}
						className="mt-3 text-primary text-sm underline-offset-4 hover:underline"
					>
						{selected ? "Selected" : "Choose this option"}
					</button>
				) : null}
			</CardContent>
		</Card>
	);
}
