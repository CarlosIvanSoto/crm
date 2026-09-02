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
	customerArchiveResultOutput,
	customerBulkInput,
	customerBulkOwnerInput,
	customerBulkResultOutput,
	customerCreateInput,
	customerDetailOutput,
	customerIdInput,
	customerListInput,
	customerListOutput,
	customerOptionOutput,
	customerOptionsInput,
	customerSummaryOutput,
	customerUpdateArgs,
} from "./customers.contracts";
import { CustomersService } from "./customers.service";

@Router({ alias: "customers" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class CustomersRouter {
	constructor(
		@Inject(CustomersService) private readonly customers: CustomersService,
	) {}

	@Query({
		input: customerListInput,
		output: customerListOutput,
		meta: restMeta("POST", "/customers/search", ["Customers"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof customerListInput>,
	) {
		return this.customers.list(ctx.agencyId, input);
	}

	@Query({
		input: customerIdInput,
		output: customerDetailOutput,
		meta: restMeta("GET", "/customers/{id}", ["Customers"]),
	})
	async byId(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.customers.byId(ctx.agencyId, id);
	}

	@Query({
		input: customerOptionsInput,
		output: customerOptionOutput,
		meta: restMeta("GET", "/customers/options", ["Customers"]),
	})
	async options(@Ctx() ctx: AgencyTrpcContext, @Input("q") q: string) {
		return this.customers.options(ctx.agencyId, q);
	}

	@Mutation({
		input: customerCreateInput,
		output: customerSummaryOutput,
		meta: restMeta("POST", "/customers", ["Customers"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof customerCreateInput>,
	) {
		return this.customers.create(ctx.agencyId, input);
	}

	@Mutation({
		input: customerUpdateArgs,
		output: customerSummaryOutput,
		meta: restMeta("PATCH", "/customers/{id}", ["Customers"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof customerUpdateArgs>,
	) {
		return this.customers.update(ctx.agencyId, input.id, input.data);
	}

	@Mutation({
		input: customerIdInput,
		output: customerArchiveResultOutput,
		meta: restMeta("POST", "/customers/{id}/archive", ["Customers"]),
	})
	async archive(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.customers.archive(ctx.agencyId, id);
	}

	@Mutation({
		input: customerIdInput,
		output: customerArchiveResultOutput,
		meta: restMeta("POST", "/customers/{id}/restore", ["Customers"]),
	})
	async restore(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.customers.restore(ctx.agencyId, id);
	}

	@Mutation({
		input: customerIdInput,
		output: customerArchiveResultOutput,
		meta: restMeta("DELETE", "/customers/{id}", ["Customers"]),
	})
	async purge(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.customers.purge(ctx.agencyId, id);
	}

	@Mutation({
		input: customerBulkOwnerInput,
		output: customerBulkResultOutput,
		meta: restMeta("POST", "/customers/bulk-assign-owner", ["Customers"]),
	})
	async bulkAssignOwner(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof customerBulkOwnerInput>,
	) {
		return this.customers.bulkAssignOwner(
			ctx.agencyId,
			input.ids,
			input.ownerId,
		);
	}

	@Mutation({
		input: customerBulkInput,
		output: customerBulkResultOutput,
		meta: restMeta("POST", "/customers/bulk-archive", ["Customers"]),
	})
	async bulkArchive(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.customers.bulkArchive(ctx.agencyId, ids);
	}

	@Mutation({
		input: customerBulkInput,
		output: customerBulkResultOutput,
		meta: restMeta("POST", "/customers/bulk-restore", ["Customers"]),
	})
	async bulkRestore(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.customers.bulkRestore(ctx.agencyId, ids);
	}

	@Mutation({
		input: customerBulkInput,
		output: customerBulkResultOutput,
		meta: restMeta("POST", "/customers/bulk-purge", ["Customers"]),
	})
	async bulkPurge(@Ctx() ctx: AgencyTrpcContext, @Input("ids") ids: string[]) {
		return this.customers.bulkPurge(ctx.agencyId, ids);
	}
}
