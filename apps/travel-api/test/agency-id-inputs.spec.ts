import { describe, expect, it } from "bun:test";
import { z } from "zod";
import * as activityContracts from "../src/activities/activities.contracts";
import * as agencyContracts from "../src/agency/agency.contracts";
import * as bookingContracts from "../src/bookings/bookings.contracts";
import * as commissionContracts from "../src/commissions/commissions.contracts";
import * as currencyContracts from "../src/currency/currency.contracts";
import * as customerContracts from "../src/customers/customers.contracts";
import * as dashboardContracts from "../src/dashboard/dashboard.contracts";
import * as documentContracts from "../src/documents/documents.contracts";
import * as fieldContracts from "../src/fields/fields.contracts";
import * as paymentContracts from "../src/payments/payments.contracts";
import * as quoteShareContracts from "../src/quote-share/quote-share.contracts";
import * as quoteContracts from "../src/quotes/quotes.contracts";
import * as savedViewContracts from "../src/saved-views/saved-views.contracts";
import * as supplierContracts from "../src/suppliers/suppliers.contracts";
import { itineraryItemInput } from "../src/travel/itinerary";
import * as travelerContracts from "../src/travelers/travelers.contracts";

/**
 * Rule 1 from docs/travel/domain.md: agencyId is never an input. It comes from
 * session.activeOrganizationId. A tRPC input schema that accepts agencyId is a
 * security bug. One test holds the rule for every module.
 */

type NamedSchema = { name: string; schema: z.ZodTypeAny };

function collect(
	label: string,
	module: Record<string, z.ZodTypeAny>,
): NamedSchema[] {
	const found: NamedSchema[] = [];
	for (const [name, value] of Object.entries(module)) {
		if (value instanceof z.ZodType) {
			found.push({ name: `${label}.${name}`, schema: value });
		}
	}
	return found;
}

function objectShape(schema: z.ZodTypeAny): z.ZodRawShape | null {
	if (schema instanceof z.ZodObject) {
		return schema.shape;
	}
	if (schema instanceof z.ZodArray) {
		return objectShape(schema.element as z.ZodTypeAny);
	}
	return null;
}

function keysOf(schema: z.ZodTypeAny): string[] {
	const shape = objectShape(schema);
	return shape ? Object.keys(shape) : [];
}

const schemas = [
	...collect("activities", activityContracts),
	...collect("agency", agencyContracts),
	...collect("bookings", bookingContracts),
	...collect("commissions", commissionContracts),
	...collect("currency", currencyContracts),
	...collect("customers", customerContracts),
	...collect("dashboard", dashboardContracts),
	...collect("documents", documentContracts),
	...collect("fields", fieldContracts),
	...collect("payments", paymentContracts),
	...collect("quotes", quoteContracts),
	...collect("quoteShare", quoteShareContracts),
	...collect("savedViews", savedViewContracts),
	...collect("suppliers", supplierContracts),
	...collect("travelers", travelerContracts),
	{ name: "itinerary.itineraryItemInput", schema: itineraryItemInput },
];

describe("no input schema accepts agencyId", () => {
	for (const { name, schema } of schemas) {
		it(`${name} has no agencyId key`, () => {
			expect(keysOf(schema)).not.toContain("agencyId");
		});
	}

	it("checked a meaningful number of schemas", () => {
		expect(schemas.length).toBeGreaterThan(40);
	});
});
