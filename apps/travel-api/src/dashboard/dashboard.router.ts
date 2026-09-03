import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import type { AgencyTrpcContext } from "../trpc/context.types";
import { AgencyMiddleware } from "../trpc/middlewares/agency.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	dashboardSummaryInput,
	dashboardSummaryOutput,
} from "./dashboard.contracts";
import { DashboardService } from "./dashboard.service";

@Router({ alias: "dashboard" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class DashboardRouter {
	constructor(
		@Inject(DashboardService) private readonly dashboard: DashboardService,
	) {}

	@Query({
		input: dashboardSummaryInput,
		output: dashboardSummaryOutput,
		meta: restMeta("GET", "/dashboard/summary", ["Dashboard"]),
	})
	async summary(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof dashboardSummaryInput>,
	) {
		return this.dashboard.summary(ctx.agencyId, ctx.role, ctx.user.id, input);
	}
}
