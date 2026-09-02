import type { AgencyRole, Session, SessionUser } from "@travel/auth";
import type { Request } from "express";

export type BaseTrpcContext = {
	req?: Request;
	session: Session | null;
};

export type AuthedTrpcContext = BaseTrpcContext & {
	user: SessionUser;
};

export type AgencyTrpcContext = AuthedTrpcContext & {
	agencyId: string;
	role: AgencyRole;
};
