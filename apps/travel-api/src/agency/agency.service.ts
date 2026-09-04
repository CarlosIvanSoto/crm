import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	type AgencyRole,
	appUrl,
	canManageAgency,
	canManageMembers,
	sendAgencyInvitation,
	toAgencyRole,
} from "@travel/auth";
import { agencyDb, type Db, Prisma } from "@travel/db";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { blankToNull } from "../travel/values";
import type {
	agencyMemberOutput,
	updateAgencyProfileInput,
} from "./agency.contracts";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function num(value: Prisma.Decimal | null): number | null {
	return value === null ? null : value.toNumber();
}

@Injectable()
export class AgencyService {
	private readonly logger = new Logger(AgencyService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async profile(agencyId: string, role: AgencyRole) {
		const organization = await this.db.organization.findUnique({
			where: { id: agencyId },
			select: { id: true, name: true, slug: true },
		});

		if (!organization) {
			throw new NotFoundException("That agency does not exist.");
		}

		const scoped = agencyDb(this.db, agencyId);
		const settings = await scoped.agencySettings.findFirst({
			where: { agencyId },
		});

		return {
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
			legalName: settings?.legalName ?? null,
			taxId: settings?.taxId ?? null,
			taxRegime: settings?.taxRegime ?? null,
			phone: settings?.phone ?? null,
			email: settings?.email ?? null,
			baseCurrency: settings?.baseCurrency ?? "USD",
			timezone: settings?.timezone ?? "America/Mexico_City",
			logoUrl: settings?.logoUrl ?? null,
			quotePrefix: settings?.quotePrefix ?? "COT",
			bookingPrefix: settings?.bookingPrefix ?? "EXP",
			defaultTerms: settings?.defaultTerms ?? null,
			defaultCommissionBasis: settings?.defaultCommissionBasis ?? null,
			defaultCommissionRate: num(settings?.defaultCommissionRate ?? null),
			viewerRole: role,
			canManage: canManageAgency(role),
		};
	}

	async updateProfile(
		agencyId: string,
		role: AgencyRole,
		input: z.infer<typeof updateAgencyProfileInput>,
	) {
		if (!canManageAgency(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change the agency.",
			);
		}

		const scoped = agencyDb(this.db, agencyId);

		const data = {
			...(input.legalName !== undefined && {
				legalName: input.legalName ? blankToNull(input.legalName) : null,
			}),
			...(input.taxId !== undefined && {
				taxId: input.taxId ? blankToNull(input.taxId) : null,
			}),
			...(input.taxRegime !== undefined && {
				taxRegime: input.taxRegime ? blankToNull(input.taxRegime) : null,
			}),
			...(input.phone !== undefined && {
				phone: input.phone ? blankToNull(input.phone) : null,
			}),
			...(input.email !== undefined && {
				email: input.email ? input.email.trim().toLowerCase() : null,
			}),
			...(input.baseCurrency !== undefined && {
				baseCurrency: input.baseCurrency.trim().toUpperCase(),
			}),
			...(input.timezone !== undefined && { timezone: input.timezone.trim() }),
			...(input.logoUrl !== undefined && { logoUrl: input.logoUrl ?? null }),
			...(input.quotePrefix !== undefined && {
				quotePrefix: input.quotePrefix.trim().toUpperCase(),
			}),
			...(input.bookingPrefix !== undefined && {
				bookingPrefix: input.bookingPrefix.trim().toUpperCase(),
			}),
			...(input.defaultTerms !== undefined && {
				defaultTerms: input.defaultTerms
					? blankToNull(input.defaultTerms)
					: null,
			}),
			...(input.defaultCommissionBasis !== undefined && {
				defaultCommissionBasis: input.defaultCommissionBasis,
			}),
			...(input.defaultCommissionRate !== undefined && {
				defaultCommissionRate:
					input.defaultCommissionRate === null
						? null
						: new Prisma.Decimal(input.defaultCommissionRate),
			}),
		};

		await scoped.agencySettings.upsert({
			where: { agencyId },
			create: { ...data, agencyId },
			update: data,
		});

		this.logger.log({ message: "Agency profile updated", agencyId });

		return this.profile(agencyId, role);
	}

	async members(
		agencyId: string,
		viewerId: string,
	): Promise<z.infer<typeof agencyMemberOutput>[]> {
		const rows = await this.db.member.findMany({
			where: { organizationId: agencyId },
			select: {
				id: true,
				role: true,
				createdAt: true,
				userId: true,
				user: { select: { name: true, email: true, image: true } },
			},
			orderBy: [{ createdAt: "asc" }],
		});

		return rows.map((row) => ({
			id: row.id,
			userId: row.userId,
			name: row.user.name,
			email: row.user.email,
			image: row.user.image,
			role: toAgencyRole(row.role),
			joinedAt: row.createdAt.toISOString(),
			isViewer: row.userId === viewerId,
		}));
	}

	async invitations(agencyId: string) {
		const rows = await this.db.invitation.findMany({
			where: { organizationId: agencyId, status: "pending" },
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
				expiresAt: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return rows.map((row) => ({
			id: row.id,
			email: row.email,
			role: toAgencyRole(row.role ?? "agent"),
			status: row.status,
			expiresAt: row.expiresAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
		}));
	}

	async invite(
		agencyId: string,
		role: AgencyRole,
		inviter: { id: string; name: string },
		input: { email: string; role: AgencyRole },
	) {
		if (!canManageMembers(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can invite members.",
			);
		}

		const email = input.email.trim().toLowerCase();

		const alreadyMember = await this.db.member.findFirst({
			where: { organizationId: agencyId, user: { email } },
			select: { id: true },
		});

		if (alreadyMember) {
			throw new BadRequestException("That person is already a member.");
		}

		const organization = await this.db.organization.findUniqueOrThrow({
			where: { id: agencyId },
			select: { name: true },
		});

		const invitation = await this.db.invitation.create({
			data: {
				id: crypto.randomUUID(),
				organizationId: agencyId,
				email,
				role: input.role,
				status: "pending",
				expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
				inviterId: inviter.id,
			},
			select: { id: true, email: true, role: true },
		});

		const acceptUrl = new URL(`/aceptar/${invitation.id}`, appUrl).toString();

		const delivery = await sendAgencyInvitation({
			email,
			agencyName: organization.name,
			inviterName: inviter.name,
			acceptUrl,
		});

		this.logger.log({
			message: "Agency invitation created",
			agencyId,
			invitationId: invitation.id,
			delivered: delivery.delivered,
		});

		return {
			id: invitation.id,
			email: invitation.email,
			role: toAgencyRole(invitation.role ?? "agent"),
			url: delivery.url,
			delivered: delivery.delivered,
		};
	}

	async revokeInvitation(
		agencyId: string,
		role: AgencyRole,
		invitationId: string,
	) {
		if (!canManageMembers(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can revoke an invitation.",
			);
		}

		const { count } = await this.db.invitation.deleteMany({
			where: { id: invitationId, organizationId: agencyId },
		});

		if (count === 0) {
			throw new NotFoundException("That invitation does not exist.");
		}

		return { id: invitationId };
	}

	async setRole(
		agencyId: string,
		actorRole: AgencyRole,
		input: { memberId: string; role: AgencyRole },
	) {
		if (!canManageMembers(actorRole)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change a member's role.",
			);
		}

		const updated = await this.db.$transaction(async (tx) => {
			const target = await tx.member.findFirst({
				where: { id: input.memberId, organizationId: agencyId },
				select: { id: true, role: true },
			});

			if (!target) {
				throw new NotFoundException("That person is not in this agency.");
			}

			if (target.role === "owner" && input.role !== "owner") {
				await this.guardLastOwner(tx, agencyId);
			}

			return tx.member.update({
				where: { id: target.id },
				data: { role: input.role },
				select: {
					id: true,
					role: true,
					createdAt: true,
					userId: true,
					user: { select: { name: true, email: true, image: true } },
				},
			});
		});

		this.logger.log({
			message: "Agency role changed",
			agencyId,
			memberId: updated.id,
			role: input.role,
		});

		return {
			id: updated.id,
			userId: updated.userId,
			name: updated.user.name,
			email: updated.user.email,
			image: updated.user.image,
			role: toAgencyRole(updated.role),
			joinedAt: updated.createdAt.toISOString(),
			isViewer: false,
		};
	}

	async removeMember(
		agencyId: string,
		actorRole: AgencyRole,
		memberId: string,
	) {
		if (!canManageMembers(actorRole)) {
			throw new ForbiddenException(
				"Only an owner or an admin can remove a member.",
			);
		}

		await this.db.$transaction(async (tx) => {
			const target = await tx.member.findFirst({
				where: { id: memberId, organizationId: agencyId },
				select: { id: true, role: true },
			});

			if (!target) {
				throw new NotFoundException("That person is not in this agency.");
			}

			if (target.role === "owner") {
				await this.guardLastOwner(tx, agencyId);
			}

			await tx.member.delete({ where: { id: target.id } });
		});

		return { id: memberId };
	}

	private async guardLastOwner(
		tx: Parameters<Parameters<Db["$transaction"]>[0]>[0],
		agencyId: string,
	): Promise<void> {
		const owners = await tx.$queryRaw<{ id: string }[]>`
			SELECT id FROM "member"
			WHERE "organizationId" = ${agencyId} AND role = 'owner'
			FOR UPDATE
		`;

		if (owners.length <= 1) {
			throw new ForbiddenException(
				"The agency needs an owner. Make someone else an owner first.",
			);
		}
	}
}
