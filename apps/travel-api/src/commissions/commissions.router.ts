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
	advisorReportOutput,
	commissionBulkInput,
	commissionBulkResultOutput,
	commissionByBookingInput,
	commissionByBookingOutput,
	commissionDeleteOutput,
	commissionIdInput,
	commissionListInput,
	commissionListOutput,
	commissionRowOutput,
	commissionSummaryOutput,
	createCommissionInput,
	supplierReportOutput,
	updateCommissionInput,
} from "./commissions.contracts";
import { CommissionsService } from "./commissions.service";

@Router({ alias: "commissions" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class CommissionsRouter {
	constructor(
		@Inject(CommissionsService)
		private readonly commissions: CommissionsService,
	) {}

	@Query({
		input: commissionListInput,
		output: commissionListOutput,
		meta: restMeta("POST", "/commissions/search", ["Commissions"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof commissionListInput>,
	) {
		return this.commissions.list(ctx.agencyId, ctx.role, ctx.user.id, input);
	}

	@Query({
		input: commissionByBookingInput,
		output: commissionByBookingOutput,
		meta: restMeta("GET", "/commissions/booking/{bookingId}", ["Commissions"]),
	})
	async byBooking(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("bookingId") bookingId: string,
	) {
		return this.commissions.byBooking(
			ctx.agencyId,
			ctx.role,
			ctx.user.id,
			bookingId,
		);
	}

	@Query({
		output: advisorReportOutput,
		meta: restMeta("GET", "/commissions/reports/advisors", ["Commissions"]),
	})
	async byAdvisor(@Ctx() ctx: AgencyTrpcContext) {
		return this.commissions.byAdvisor(ctx.agencyId, ctx.role, ctx.user.id);
	}

	@Query({
		output: supplierReportOutput,
		meta: restMeta("GET", "/commissions/reports/suppliers", ["Commissions"]),
	})
	async bySupplier(@Ctx() ctx: AgencyTrpcContext) {
		return this.commissions.bySupplier(ctx.agencyId, ctx.role);
	}

	@Mutation({
		input: createCommissionInput,
		output: commissionSummaryOutput,
		meta: restMeta("POST", "/commissions", ["Commissions"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof createCommissionInput>,
	) {
		return this.commissions.create(ctx.agencyId, ctx.role, ctx.user.id, input);
	}

	@Mutation({
		input: updateCommissionInput,
		output: commissionRowOutput,
		meta: restMeta("PATCH", "/commissions/{id}", ["Commissions"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof updateCommissionInput>,
	) {
		return this.commissions.update(ctx.agencyId, ctx.role, input);
	}

	@Mutation({
		input: commissionIdInput,
		output: commissionRowOutput,
		meta: restMeta("POST", "/commissions/{id}/recalculate", ["Commissions"]),
	})
	async recalculate(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.commissions.recalculate(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: commissionIdInput,
		output: commissionSummaryOutput,
		meta: restMeta("POST", "/commissions/{id}/approve", ["Commissions"]),
	})
	async approve(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.commissions.approve(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: commissionIdInput,
		output: commissionSummaryOutput,
		meta: restMeta("POST", "/commissions/{id}/pay", ["Commissions"]),
	})
	async markPaid(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.commissions.markPaid(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: commissionIdInput,
		output: commissionSummaryOutput,
		meta: restMeta("POST", "/commissions/{id}/void", ["Commissions"]),
	})
	async void(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.commissions.voidCommission(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: commissionIdInput,
		output: commissionDeleteOutput,
		meta: restMeta("DELETE", "/commissions/{id}", ["Commissions"]),
	})
	async remove(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.commissions.remove(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: commissionBulkInput,
		output: commissionBulkResultOutput,
		meta: restMeta("POST", "/commissions/bulk-approve", ["Commissions"]),
	})
	async bulkApprove(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.commissions.bulkApprove(ctx.agencyId, ctx.role, ids);
	}

	@Mutation({
		input: commissionBulkInput,
		output: commissionBulkResultOutput,
		meta: restMeta("POST", "/commissions/bulk-pay", ["Commissions"]),
	})
	async bulkMarkPaid(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.commissions.bulkMarkPaid(ctx.agencyId, ctx.role, ids);
	}
}
