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
	addPayableInput,
	addPaymentInput,
	paymentDeleteOutput,
	paymentIdInput,
	paymentListInput,
	paymentListOutput,
	paymentSummaryOutput,
	recordPaymentInput,
} from "./payments.contracts";
import { PaymentsService } from "./payments.service";

@Router({ alias: "payments" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class PaymentsRouter {
	constructor(
		@Inject(PaymentsService) private readonly payments: PaymentsService,
	) {}

	@Query({
		input: paymentListInput,
		output: paymentListOutput,
		meta: restMeta("POST", "/payments/search", ["Payments"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof paymentListInput>,
	) {
		return this.payments.list(ctx.agencyId, input);
	}

	@Mutation({
		input: addPaymentInput,
		output: paymentSummaryOutput,
		meta: restMeta("POST", "/payments", ["Payments"]),
	})
	async add(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof addPaymentInput>,
	) {
		return this.payments.add(ctx.agencyId, ctx.role, input);
	}

	@Mutation({
		input: recordPaymentInput,
		output: paymentSummaryOutput,
		meta: restMeta("POST", "/payments/{id}/record", ["Payments"]),
	})
	async record(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof recordPaymentInput>,
	) {
		return this.payments.record(ctx.agencyId, ctx.role, input);
	}

	@Mutation({
		input: paymentIdInput,
		output: paymentSummaryOutput,
		meta: restMeta("POST", "/payments/{id}/void", ["Payments"]),
	})
	async void(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.payments.voidPayment(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: paymentIdInput,
		output: paymentDeleteOutput,
		meta: restMeta("DELETE", "/payments/{id}", ["Payments"]),
	})
	async remove(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.payments.remove(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: addPayableInput,
		output: paymentSummaryOutput,
		meta: restMeta("POST", "/payables", ["Payments"]),
	})
	async addPayable(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof addPayableInput>,
	) {
		return this.payments.addPayable(ctx.agencyId, ctx.role, input);
	}

	@Mutation({
		input: recordPaymentInput,
		output: paymentSummaryOutput,
		meta: restMeta("POST", "/payables/{id}/record", ["Payments"]),
	})
	async recordPayable(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof recordPaymentInput>,
	) {
		return this.payments.recordPayable(ctx.agencyId, ctx.role, input);
	}

	@Mutation({
		input: paymentIdInput,
		output: paymentSummaryOutput,
		meta: restMeta("POST", "/payables/{id}/void", ["Payments"]),
	})
	async voidPayable(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.payments.voidPayable(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: paymentIdInput,
		output: paymentDeleteOutput,
		meta: restMeta("DELETE", "/payables/{id}", ["Payments"]),
	})
	async removePayable(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.payments.removePayable(ctx.agencyId, ctx.role, id);
	}
}
