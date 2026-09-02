import { Injectable } from "@nestjs/common";
import { agencyRoleOf } from "@travel/auth";
import type { Db } from "@travel/db";
import { TRPCError } from "@trpc/server";
import type {
	MiddlewareOptions,
	MiddlewareResponse,
	TRPCMiddleware,
} from "nestjs-trpc";
import { InjectDatabase } from "../../database/database.constants";
import type { AgencyTrpcContext, AuthedTrpcContext } from "../context.types";

@Injectable()
export class AgencyMiddleware implements TRPCMiddleware {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async use(opts: MiddlewareOptions): Promise<MiddlewareResponse> {
		const ctx = opts.ctx as AuthedTrpcContext;
		const agencyId = ctx.session?.session.activeOrganizationId;

		if (!agencyId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Choose an agency before you continue.",
			});
		}

		const role = await agencyRoleOf(this.db, agencyId, ctx.user.id);

		if (!role) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You are not a member of this agency.",
			});
		}

		const nextCtx: AgencyTrpcContext = { ...ctx, agencyId, role };
		return opts.next({ ctx: nextCtx });
	}
}
