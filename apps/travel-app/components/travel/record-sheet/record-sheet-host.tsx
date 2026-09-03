"use client";

import { useState } from "react";
import { DetailSheet } from "@/components/detail-sheet";
import { BookingSheet } from "./booking-sheet";
import { CustomerSheet } from "./customer-sheet";
import { QuoteSheet } from "./quote-sheet";
import { type RecordRef, recordKey, useRecordStack } from "./record-stack";
import { SupplierSheet } from "./supplier-sheet";
import { TravelerSheet } from "./traveler-sheet";

export function RecordSheetHost() {
	const { stack, top, closeAll } = useRecordStack();

	const [shown, setShown] = useState<RecordRef | null>(top);
	if (top && (!shown || recordKey(shown) !== recordKey(top))) setShown(top);

	return (
		<DetailSheet
			open={stack.length > 0}
			onOpenChange={(next) => {
				if (!next) closeAll();
			}}
		>
			{shown?.kind === "customer" ? (
				<CustomerSheet key={recordKey(shown)} customerId={shown.id} />
			) : null}
			{shown?.kind === "supplier" ? (
				<SupplierSheet key={recordKey(shown)} supplierId={shown.id} />
			) : null}
			{shown?.kind === "traveler" ? (
				<TravelerSheet key={recordKey(shown)} travelerId={shown.id} />
			) : null}
			{shown?.kind === "quote" ? (
				<QuoteSheet key={recordKey(shown)} quoteId={shown.id} />
			) : null}
			{shown?.kind === "booking" ? (
				<BookingSheet key={recordKey(shown)} bookingId={shown.id} />
			) : null}
		</DetailSheet>
	);
}
