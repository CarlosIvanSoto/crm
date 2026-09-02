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
	supplierArchiveResultOutput,
	supplierBulkInput,
	supplierBulkResultOutput,
	supplierCreateInput,
	supplierDetailOutput,
	supplierIdInput,
	supplierListInput,
	supplierListOutput,
	supplierOptionOutput,
	supplierOptionsInput,
	supplierSummaryOutput,
	supplierUpdateArgs,
} from "./suppliers.contracts";
import { SuppliersService } from "./suppliers.service";

@Router({ alias: "suppliers" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class SuppliersRouter {
	constructor(
		@Inject(SuppliersService) private readonly suppliers: SuppliersService,
	) {}

	@Query({
		input: supplierListInput,
		output: supplierListOutput,
		meta: restMeta("POST", "/suppliers/search", ["Suppliers"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof supplierListInput>,
	) {
		return this.suppliers.list(ctx.agencyId, input);
	}

	@Query({
		input: supplierIdInput,
		output: supplierDetailOutput,
		meta: restMeta("GET", "/suppliers/{id}", ["Suppliers"]),
	})
	async byId(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.suppliers.byId(ctx.agencyId, id);
	}

	@Query({
		input: supplierOptionsInput,
		output: supplierOptionOutput,
		meta: restMeta("GET", "/suppliers/options", ["Suppliers"]),
	})
	async options(@Ctx() ctx: AgencyTrpcContext, @Input("q") q: string) {
		return this.suppliers.options(ctx.agencyId, q);
	}

	@Mutation({
		input: supplierCreateInput,
		output: supplierSummaryOutput,
		meta: restMeta("POST", "/suppliers", ["Suppliers"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof supplierCreateInput>,
	) {
		return this.suppliers.create(ctx.agencyId, input);
	}

	@Mutation({
		input: supplierUpdateArgs,
		output: supplierSummaryOutput,
		meta: restMeta("PATCH", "/suppliers/{id}", ["Suppliers"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof supplierUpdateArgs>,
	) {
		return this.suppliers.update(ctx.agencyId, input.id, input.data);
	}

	@Mutation({
		input: supplierIdInput,
		output: supplierArchiveResultOutput,
		meta: restMeta("POST", "/suppliers/{id}/archive", ["Suppliers"]),
	})
	async archive(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.suppliers.archive(ctx.agencyId, id);
	}

	@Mutation({
		input: supplierIdInput,
		output: supplierArchiveResultOutput,
		meta: restMeta("POST", "/suppliers/{id}/restore", ["Suppliers"]),
	})
	async restore(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.suppliers.restore(ctx.agencyId, id);
	}

	@Mutation({
		input: supplierIdInput,
		output: supplierArchiveResultOutput,
		meta: restMeta("DELETE", "/suppliers/{id}", ["Suppliers"]),
	})
	async purge(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.suppliers.purge(ctx.agencyId, id);
	}

	@Mutation({
		input: supplierBulkInput,
		output: supplierBulkResultOutput,
		meta: restMeta("POST", "/suppliers/bulk-archive", ["Suppliers"]),
	})
	async bulkArchive(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.suppliers.bulkArchive(ctx.agencyId, ids);
	}

	@Mutation({
		input: supplierBulkInput,
		output: supplierBulkResultOutput,
		meta: restMeta("POST", "/suppliers/bulk-restore", ["Suppliers"]),
	})
	async bulkRestore(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.suppliers.bulkRestore(ctx.agencyId, ids);
	}

	@Mutation({
		input: supplierBulkInput,
		output: supplierBulkResultOutput,
		meta: restMeta("POST", "/suppliers/bulk-purge", ["Suppliers"]),
	})
	async bulkPurge(@Ctx() ctx: AgencyTrpcContext, @Input("ids") ids: string[]) {
		return this.suppliers.bulkPurge(ctx.agencyId, ids);
	}
}
