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
	bulkResultOutput,
	createDocumentInput,
	documentEntryOutput,
	documentIdInput,
	documentListInput,
	documentListOutput,
	downloadUrlOutput,
	removeManyInput,
	removeOutput,
	storageStatusOutput,
	updateDocumentInput,
	uploadTokenInput,
	uploadTokenOutput,
} from "./documents.contracts";
import { DocumentsService } from "./documents.service";

@Router({ alias: "documents" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class DocumentsRouter {
	constructor(
		@Inject(DocumentsService) private readonly documents: DocumentsService,
	) {}

	@Query({
		output: storageStatusOutput,
		meta: restMeta("GET", "/documents/storage", ["Documents"]),
	})
	async storage() {
		return this.documents.storage();
	}

	@Mutation({
		input: uploadTokenInput,
		output: uploadTokenOutput,
		meta: restMeta("POST", "/documents/upload-token", ["Documents"]),
	})
	async uploadToken(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof uploadTokenInput>,
	) {
		return this.documents.uploadToken(ctx.agencyId, input);
	}

	@Mutation({
		input: createDocumentInput,
		output: documentEntryOutput,
		meta: restMeta("POST", "/documents", ["Documents"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof createDocumentInput>,
	) {
		return this.documents.create(ctx.agencyId, ctx.user.id, input);
	}

	@Query({
		input: documentListInput,
		output: documentListOutput,
		meta: restMeta("POST", "/documents/search", ["Documents"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof documentListInput>,
	) {
		return this.documents.list(ctx.agencyId, ctx.role, ctx.user.id, input);
	}

	@Query({
		input: documentIdInput,
		output: downloadUrlOutput,
		meta: restMeta("GET", "/documents/{id}/download", ["Documents"]),
	})
	async downloadUrl(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.documents.downloadUrl(ctx.agencyId, ctx.role, ctx.user.id, id);
	}

	@Mutation({
		input: updateDocumentInput,
		output: documentEntryOutput,
		meta: restMeta("PATCH", "/documents/{id}", ["Documents"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof updateDocumentInput>,
	) {
		return this.documents.update(ctx.agencyId, ctx.role, ctx.user.id, input);
	}

	@Mutation({
		input: documentIdInput,
		output: removeOutput,
		meta: restMeta("DELETE", "/documents/{id}", ["Documents"]),
	})
	async remove(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.documents.remove(ctx.agencyId, ctx.role, ctx.user.id, id);
	}

	@Mutation({
		input: removeManyInput,
		output: bulkResultOutput,
		meta: restMeta("POST", "/documents/remove-many", ["Documents"]),
	})
	async removeMany(@Ctx() ctx: AgencyTrpcContext, @Input("ids") ids: string[]) {
		return this.documents.removeMany(ctx.agencyId, ctx.role, ctx.user.id, ids);
	}
}
