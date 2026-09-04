import { CommissionBasis } from "@travel/db/enums";
import { z } from "zod";

const agencyRole = z.enum(["owner", "admin", "agent", "accountant"]);

const commissionBasis = z.enum(
	Object.values(CommissionBasis) as [CommissionBasis, ...CommissionBasis[]],
);

const commissionRate = z.number().min(0).max(1);

export const agencyProfileOutput = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	legalName: z.string().nullable(),
	taxId: z.string().nullable(),
	taxRegime: z.string().nullable(),
	phone: z.string().nullable(),
	email: z.string().nullable(),
	baseCurrency: z.string(),
	timezone: z.string(),
	logoUrl: z.string().nullable(),
	quotePrefix: z.string(),
	bookingPrefix: z.string(),
	defaultTerms: z.string().nullable(),
	defaultCommissionBasis: commissionBasis.nullable(),
	defaultCommissionRate: z.number().nullable(),
	viewerRole: agencyRole,
	canManage: z.boolean(),
});

export const updateAgencyProfileInput = z.object({
	legalName: z.string().trim().max(200).nullable().optional(),
	taxId: z.string().trim().max(40).nullable().optional(),
	taxRegime: z.string().trim().max(120).nullable().optional(),
	phone: z.string().trim().max(40).nullable().optional(),
	email: z.string().trim().email().nullable().optional(),
	baseCurrency: z.string().trim().length(3).optional(),
	timezone: z.string().trim().max(60).optional(),
	logoUrl: z.string().trim().url().nullable().optional(),
	quotePrefix: z.string().trim().min(1).max(8).optional(),
	bookingPrefix: z.string().trim().min(1).max(8).optional(),
	defaultTerms: z.string().trim().max(4000).nullable().optional(),
	defaultCommissionBasis: commissionBasis.nullable().optional(),
	defaultCommissionRate: commissionRate.nullable().optional(),
});

export const agencyMemberOutput = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	role: agencyRole,
	joinedAt: z.string(),
	isViewer: z.boolean(),
});

export const agencyMemberListOutput = z.array(agencyMemberOutput);

export const inviteMemberInput = z.object({
	email: z.string().trim().email("That is not an email address."),
	role: agencyRole.default("agent"),
});

export const inviteMemberOutput = z.object({
	id: z.string(),
	email: z.string(),
	role: agencyRole,
	url: z.string(),
	delivered: z.boolean(),
});

export const invitationOutput = z.object({
	id: z.string(),
	email: z.string(),
	role: agencyRole,
	status: z.string(),
	expiresAt: z.string(),
	createdAt: z.string(),
});

export const invitationListOutput = z.array(invitationOutput);

export const invitationIdInput = z.object({ invitationId: z.string() });

export const setMemberRoleInput = z.object({
	memberId: z.string(),
	role: agencyRole,
});

export const memberIdInput = z.object({ memberId: z.string() });
