import { Inject } from "@nestjs/common";
import { Ctx, Query, Router, UseMiddlewares } from "nestjs-trpc";
import { z } from "zod";
import type { AgencyTrpcContext } from "../trpc/context.types";
import { AgencyMiddleware } from "../trpc/middlewares/agency.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { userOptionOutput } from "./users.contracts";
import { UsersService } from "./users.service";

const meOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	agencyId: z.string(),
	role: z.enum(["owner", "admin", "agent", "accountant"]),
});

@Router({ alias: "users" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class UsersRouter {
	constructor(@Inject(UsersService) private readonly users: UsersService) {}

	@Query({
		output: meOutput,
		meta: restMeta("GET", "/users/me", ["Users"]),
	})
	async me(@Ctx() ctx: AgencyTrpcContext) {
		return {
			id: ctx.user.id,
			name: ctx.user.name,
			email: ctx.user.email,
			image: ctx.user.image ?? null,
			agencyId: ctx.agencyId,
			role: ctx.role,
		};
	}

	@Query({
		output: userOptionOutput,
		meta: restMeta("GET", "/users", ["Users"]),
	})
	async list(@Ctx() ctx: AgencyTrpcContext) {
		return this.users.list(ctx.agencyId);
	}
}
