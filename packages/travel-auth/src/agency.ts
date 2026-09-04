import type { Db } from "@travel/db";

export const AGENCY_ROLES = ["owner", "admin", "agent", "accountant"] as const;

export type AgencyRole = (typeof AGENCY_ROLES)[number];

export function isAgencyRole(value: string): value is AgencyRole {
	return (AGENCY_ROLES as readonly string[]).includes(value);
}

export function toAgencyRole(value: string): AgencyRole {
	return isAgencyRole(value) ? value : "agent";
}

export function isAgencyAdmin(role: AgencyRole | null): boolean {
	return role === "owner" || role === "admin";
}

export function canManageAgency(role: AgencyRole | null): boolean {
	return isAgencyAdmin(role);
}

export function canManageMembers(role: AgencyRole | null): boolean {
	return isAgencyAdmin(role);
}

export function canSeeMargins(role: AgencyRole | null): boolean {
	return isAgencyAdmin(role) || role === "accountant";
}

export function canRecordPayment(role: AgencyRole | null): boolean {
	return isAgencyAdmin(role) || role === "accountant";
}

export function canManageCommission(role: AgencyRole | null): boolean {
	return isAgencyAdmin(role) || role === "accountant";
}

export type AgencyMemberReader = Pick<Db, "member">;

export async function agencyRoleOf(
	client: AgencyMemberReader,
	organizationId: string,
	userId: string,
): Promise<AgencyRole | null> {
	const member = await client.member.findUnique({
		where: { organizationId_userId: { organizationId, userId } },
		select: { role: true },
	});

	return member ? toAgencyRole(member.role) : null;
}
