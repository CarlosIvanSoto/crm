"use client";

import Printer from "@carbon/icons-react/es/Printer";
import { Button } from "@crm/ui/components/button";

export function PrintButton() {
	return (
		<Button
			variant="outline"
			size="sm"
			data-print="hide"
			onClick={() => window.print()}
		>
			<Printer />
			Save as PDF
		</Button>
	);
}
