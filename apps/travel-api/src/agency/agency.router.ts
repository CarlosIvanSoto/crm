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
	agencyMemberListOutput,
	agencyMemberOutput,
	agencyProfileOutput,
	invitationIdInput,
	invitationListOutput,
	inviteMemberInput,
	inviteMemberOutput,
	memberIdInput,
	setMemberRoleInput,
	updateAgencyProfileInput,
} from "./agency.contracts";
import { AgencyService } from "./agency.service";

@Router({ alias: "agency" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class AgencyRouter {
	constructor(@Inject(AgencyService) private readonly agency: AgencyService) {}

	@Query({
		output: agencyProfileOutput,
		meta: restMeta("GET", "/agency/profile", ["Agency"]),
	})
	async profile(@Ctx() ctx: AgencyTrpcContext) {
		return this.agency.profile(ctx.agencyId, ctx.role);
	}

	@Mutation({
		input: updateAgencyProfileInput,
		output: agencyProfileOutput,
		meta: restMeta("PATCH", "/agency/profile", ["Agency"]),
	})
	async updateProfile(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof updateAgencyProfileInput>,
	) {
		return this.agency.updateProfile(ctx.agencyId, ctx.role, input);
	}

	@Query({
		output: agencyMemberListOutput,
		meta: restMeta("GET", "/agency/members", ["Agency"]),
	})
	async members(@Ctx() ctx: AgencyTrpcContext) {
		return this.agency.members(ctx.agencyId, ctx.user.id);
	}

	@Query({
		output: invitationListOutput,
		meta: restMeta("GET", "/agency/invitations", ["Agency"]),
	})
	async invitations(@Ctx() ctx: AgencyTrpcContext) {
		return this.agency.invitations(ctx.agencyId);
	}

	@Mutation({
		input: inviteMemberInput,
		output: inviteMemberOutput,
		meta: restMeta("POST", "/agency/invitations", ["Agency"]),
	})
	async invite(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof inviteMemberInput>,
	) {
		return this.agency.invite(
			ctx.agencyId,
			ctx.role,
			{ id: ctx.user.id, name: ctx.user.name },
			input,
		);
	}

	@Mutation({
		input: invitationIdInput,
		output: invitationIdInput,
		meta: restMeta("DELETE", "/agency/invitations/{invitationId}", ["Agency"]),
	})
	async revokeInvitation(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("invitationId") invitationId: string,
	) {
		return this.agency.revokeInvitation(ctx.agencyId, ctx.role, invitationId);
	}

	@Mutation({
		input: setMemberRoleInput,
		output: agencyMemberOutput,
		meta: restMeta("POST", "/agency/members/set-role", ["Agency"]),
	})
	async setRole(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setMemberRoleInput>,
	) {
		return this.agency.setRole(ctx.agencyId, ctx.role, input);
	}

	@Mutation({
		input: memberIdInput,
		output: memberIdInput,
		meta: restMeta("DELETE", "/agency/members/{memberId}", ["Agency"]),
	})
	async removeMember(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("memberId") memberId: string,
	) {
		return this.agency.removeMember(ctx.agencyId, ctx.role, memberId);
	}
}
