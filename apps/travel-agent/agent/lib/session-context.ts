import { z } from "zod";

type SessionAttributes = Readonly<Record<string, string | readonly string[]>>;

type SessionPrincipal = {
	readonly principalId: string;
	readonly attributes: SessionAttributes;
};

type SessionContext = {
	readonly session: {
		readonly id: string;
		readonly auth: {
			readonly current: SessionPrincipal | null;
			readonly initiator: SessionPrincipal | null;
		};
	};
};

const attributeText = z.string().trim().min(1).nullable().catch(null);

export function attribute(ctx: SessionContext, key: string): string | null {
	return (
		attributeText.parse(ctx.session.auth.current?.attributes[key]) ??
		attributeText.parse(ctx.session.auth.initiator?.attributes[key])
	);
}

export function requireAttribute(ctx: SessionContext, key: string): string {
	const value = attribute(ctx, key);
	if (!value) throw new Error(`This session is missing ${key}.`);
	return value;
}

export function principalId(ctx: SessionContext): string | null {
	return (
		ctx.session.auth.current?.principalId ??
		ctx.session.auth.initiator?.principalId ??
		null
	);
}

export type { SessionContext };
