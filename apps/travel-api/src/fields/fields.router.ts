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
	fieldByKeyInput,
	fieldCoverageOutput,
	fieldCreateInput,
	fieldDeleteOutput,
	fieldEntityInput,
	fieldFiltersOutput,
	fieldIdInput,
	fieldListInput,
	fieldListOutput,
	fieldReorderInput,
	fieldReorderOutput,
	fieldUpdateArgs,
	fieldValuesInput,
	recordFieldListOutput,
	serializedFieldOutput,
	setFieldValuesInput,
} from "./fields.contracts";
import { FieldsService } from "./fields.service";

@Router({ alias: "fields" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class FieldsRouter {
	constructor(@Inject(FieldsService) private readonly fields: FieldsService) {}

	@Query({
		input: fieldListInput,
		output: fieldListOutput,
		meta: restMeta("GET", "/fields", ["Fields"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof fieldListInput>,
	) {
		return this.fields.list(ctx.agencyId, input.entity, input.includeArchived);
	}

	@Query({
		input: fieldByKeyInput,
		output: serializedFieldOutput,
		meta: restMeta("GET", "/fields/{entity}/{key}", ["Fields"]),
	})
	async byKey(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof fieldByKeyInput>,
	) {
		return this.fields.byKey(ctx.agencyId, input.entity, input.key);
	}

	@Query({
		input: fieldEntityInput,
		output: fieldFiltersOutput,
		meta: restMeta("GET", "/fields/{entity}/filterable", ["Fields"]),
	})
	async filters(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof fieldEntityInput>,
	) {
		return this.fields.filters(ctx.agencyId, input.entity);
	}

	@Query({
		input: fieldIdInput,
		output: fieldCoverageOutput,
		meta: restMeta("GET", "/fields/{id}/coverage", ["Fields"]),
	})
	async coverage(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.fields.coverage(ctx.agencyId, id);
	}

	@Query({
		input: fieldValuesInput,
		output: recordFieldListOutput,
		meta: restMeta("GET", "/fields/values/{entity}/{recordId}", ["Fields"]),
	})
	async values(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof fieldValuesInput>,
	) {
		return this.fields.valuesFor(ctx.agencyId, input.entity, input.recordId);
	}

	@Mutation({
		input: fieldCreateInput,
		output: serializedFieldOutput,
		meta: restMeta("POST", "/fields", ["Fields"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof fieldCreateInput>,
	) {
		return this.fields.create(ctx.agencyId, input);
	}

	@Mutation({
		input: fieldUpdateArgs,
		output: serializedFieldOutput,
		meta: restMeta("PATCH", "/fields/{id}", ["Fields"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof fieldUpdateArgs>,
	) {
		return this.fields.update(ctx.agencyId, input.id, input.data);
	}

	@Mutation({
		input: fieldReorderInput,
		output: fieldReorderOutput,
		meta: restMeta("POST", "/fields/reorder", ["Fields"]),
	})
	async reorder(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof fieldReorderInput>,
	) {
		return this.fields.reorder(ctx.agencyId, input);
	}

	@Mutation({
		input: setFieldValuesInput,
		output: recordFieldListOutput,
		meta: restMeta("PUT", "/fields/values/{entity}/{recordId}", ["Fields"]),
	})
	async setValues(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setFieldValuesInput>,
	) {
		return this.fields.setValues(
			ctx.agencyId,
			input.entity,
			input.recordId,
			input.values,
		);
	}

	@Mutation({
		input: fieldIdInput,
		output: serializedFieldOutput,
		meta: restMeta("POST", "/fields/{id}/archive", ["Fields"]),
	})
	async archive(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.fields.archive(ctx.agencyId, id);
	}

	@Mutation({
		input: fieldIdInput,
		output: serializedFieldOutput,
		meta: restMeta("POST", "/fields/{id}/restore", ["Fields"]),
	})
	async restore(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.fields.restore(ctx.agencyId, id);
	}

	@Mutation({
		input: fieldIdInput,
		output: fieldDeleteOutput,
		meta: restMeta("DELETE", "/fields/{id}", ["Fields"]),
	})
	async delete(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.fields.delete(ctx.agencyId, id);
	}
}
