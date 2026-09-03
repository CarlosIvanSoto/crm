import { db } from "@travel/db";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins/organization";
import { AUTH_COOKIE_PREFIX } from "./cookies";
import { env } from "./env";
import { sendAgencyInvitation } from "./invitations";

const GOOGLE_PROVIDER_ID = "google";

const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};

if (env.google) {
	socialProviders.google = {
		clientId: env.google.clientId,
		clientSecret: env.google.clientSecret,
		accessType: "offline",
		prompt: "select_account",
	};
}

export const auth = betterAuth({
	appName: "Travel",
	baseURL: env.apiUrl,
	...(env.secret && { secret: env.secret }),

	database: prismaAdapter(db, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: true,
	},

	socialProviders,

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: [GOOGLE_PROVIDER_ID],
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},

	rateLimit: {
		enabled: true,
		storage: "database",
	},

	advanced: {
		cookiePrefix: AUTH_COOKIE_PREFIX,

		useSecureCookies: env.isProduction,
		...(env.cookieDomain && {
			crossSubDomainCookies: {
				enabled: true,
				domain: env.cookieDomain,
			},
		}),
	},

	trustedOrigins: [...env.trustedOrigins],

	plugins: [
		organization({
			allowUserToCreateOrganization: true,
			disableOrganizationDeletion: true,
			creatorRole: "owner",

			async sendInvitationEmail(data) {
				await sendAgencyInvitation({
					email: data.email,
					agencyName: data.organization.name,
					inviterName: data.inviter.user.name,
					acceptUrl: new URL(`/accept/${data.id}`, env.appUrl).toString(),
				});
			},
		}),
	],

	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					const membership = await db.member.findFirst({
						where: { userId: session.userId },
						orderBy: { createdAt: "asc" },
						select: { organizationId: true },
					});

					return {
						data: {
							...session,
							activeOrganizationId: membership?.organizationId ?? null,
						},
					};
				},
			},
		},
	},
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
