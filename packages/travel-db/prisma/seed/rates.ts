import { db } from "../../src/client";
import { RATE_PROVIDER } from "./config";
import { daysFromNow } from "./random";

interface RateRow {
	baseCurrency: string;
	quoteCurrency: string;
	rate: string;
	source: "FETCHED" | "MANUAL";
}

const RATES: RateRow[] = [
	{
		baseCurrency: "USD",
		quoteCurrency: "EUR",
		rate: "1.0800000000",
		source: "FETCHED",
	},
	{
		baseCurrency: "USD",
		quoteCurrency: "GBP",
		rate: "1.2700000000",
		source: "FETCHED",
	},
	{
		baseCurrency: "USD",
		quoteCurrency: "GBP",
		rate: "1.3050000000",
		source: "MANUAL",
	},
	{
		baseCurrency: "USD",
		quoteCurrency: "CAD",
		rate: "0.7300000000",
		source: "FETCHED",
	},
	{
		baseCurrency: "USD",
		quoteCurrency: "AUD",
		rate: "0.6600000000",
		source: "FETCHED",
	},
	{
		baseCurrency: "EUR",
		quoteCurrency: "USD",
		rate: "0.9300000000",
		source: "FETCHED",
	},
	{
		baseCurrency: "EUR",
		quoteCurrency: "GBP",
		rate: "1.1700000000",
		source: "FETCHED",
	},
	{
		baseCurrency: "EUR",
		quoteCurrency: "CAD",
		rate: "0.6800000000",
		source: "FETCHED",
	},
	{
		baseCurrency: "EUR",
		quoteCurrency: "AUD",
		rate: "0.6100000000",
		source: "FETCHED",
	},
];

export async function seedRates(): Promise<number> {
	const asOf = daysFromNow(-1);

	for (const row of RATES) {
		await db.exchangeRate.create({
			data: {
				baseCurrency: row.baseCurrency,
				quoteCurrency: row.quoteCurrency,
				rate: row.rate,
				asOf,
				source: row.source,
				provider: RATE_PROVIDER,
			},
		});
	}

	return RATES.length;
}
