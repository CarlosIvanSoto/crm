import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AgencyTrpcContext } from "../trpc/context.types";
import { AgencyMiddleware } from "../trpc/middlewares/agency.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	currencySettingsOutput,
	removeManualRateInput,
	setBaseCurrencyInput,
	setManualRateInput,
} from "./currency.contracts";
import { CurrencyService } from "./currency.service";

@Router({ alias: "currency" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class CurrencyRouter {
	constructor(
		@Inject(CurrencyService) private readonly currency: CurrencyService,
	) {}

	@Query({
		output: currencySettingsOutput,
		meta: restMeta("GET", "/currency/settings", ["Currency"]),
	})
	async settings(@Ctx() ctx: AgencyTrpcContext) {
		return this.currency.settings(ctx.agencyId, ctx.role);
	}

	@Mutation({
		input: setBaseCurrencyInput,
		output: currencySettingsOutput,
		meta: restMeta("PATCH", "/currency/base-currency", ["Currency"]),
	})
	async setBaseCurrency(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setBaseCurrencyInput>,
	) {
		return this.currency.setBaseCurrency(
			ctx.agencyId,
			ctx.role,
			input.currency,
		);
	}

	@Mutation({
		input: setManualRateInput,
		output: currencySettingsOutput,
		meta: restMeta("PUT", "/currency/rates/{currency}", ["Currency"]),
	})
	async setManualRate(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setManualRateInput>,
	) {
		return this.currency.setManualRate(
			ctx.agencyId,
			ctx.role,
			input.currency,
			input.rate,
		);
	}

	@Mutation({
		input: removeManualRateInput,
		output: currencySettingsOutput,
		meta: restMeta("DELETE", "/currency/rates/{currency}", ["Currency"]),
	})
	async removeManualRate(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof removeManualRateInput>,
	) {
		return this.currency.removeManualRate(
			ctx.agencyId,
			ctx.role,
			input.currency,
		);
	}

	@Mutation({
		output: currencySettingsOutput,
		meta: restMeta("POST", "/currency/rates/refresh", ["Currency"]),
	})
	async refreshRates(@Ctx() ctx: AgencyTrpcContext) {
		return this.currency.refresh(ctx.agencyId, ctx.role);
	}
}
