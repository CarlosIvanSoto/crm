import { Injectable } from "@nestjs/common";
import { agencyDb, type Db, type Prisma } from "@travel/db";
import { normalizeCurrency } from "@travel/db/currency";
import { convertToBase } from "@travel/db/fx";
import { InjectDatabase } from "../database/database.constants";

export interface FxFields {
	baseAmount: Prisma.Decimal | null;
	baseCurrency: string | null;
	fxRate: Prisma.Decimal | null;
	fxRateAt: Date | null;
}

const EMPTY: FxFields = {
	baseAmount: null,
	baseCurrency: null,
	fxRate: null,
	fxRateAt: null,
};

@Injectable()
export class ConversionService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async baseCurrencyFor(agencyId: string): Promise<string> {
		const scoped = agencyDb(this.db, agencyId);
		const settings = await scoped.agencySettings.findFirst({
			where: { agencyId },
			select: { baseCurrency: true },
		});
		return normalizeCurrency(settings?.baseCurrency ?? "USD");
	}

	async itemFields(
		agencyId: string,
		amount: Prisma.Decimal | null,
		currency: string,
	): Promise<FxFields> {
		if (amount === null) return EMPTY;

		const base = await this.baseCurrencyFor(agencyId);
		const converted = await convertToBase(this.db, amount, currency, base);

		if (!converted) return EMPTY;

		return {
			baseAmount: converted.baseAmount,
			baseCurrency: converted.baseCurrency,
			fxRate: converted.fxRate,
			fxRateAt: converted.fxRateAt,
		};
	}
}
