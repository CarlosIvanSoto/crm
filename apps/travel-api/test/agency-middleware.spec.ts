import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@travel/db";
import { TRPCError } from "@trpc/server";
import { AgencyMiddleware } from "../src/trpc/middlewares/agency.middleware";
import { dropAgency, type SeededAgency, seedAgency } from "./helpers";

const middleware = new AgencyMiddleware(db);

let a: SeededAgency;
let stranger: string;

beforeAll(async () => {
	a = await seedAgency("mw-a");
	const other = await seedAgency("mw-b");
	stranger = other.ownerUserId;
	// drop the stranger's membership so they belong to no agency
	await db.member.deleteMany({ where: { userId: stranger } });
	await dropAgency(other.agencyId);
});

afterAll(async () => {
	await dropAgency(a.agencyId);
	await db.user.deleteMany({ where: { id: stranger } });
	await db.$disconnect();
});

type FakeSession = { session: { activeOrganizationId?: string } };

function fakeOpts(session: FakeSession, userId: string) {
	return {
		ctx: { session, user: { id: userId } },
		next: async ({ ctx }: { ctx: object }) => ({ ok: true as const, ctx }),
	};
}

describe("AgencyMiddleware", () => {
	it("rejects a session with no active organization", async () => {
		const opts = fakeOpts({ session: {} }, a.ownerUserId);
		// biome-ignore lint/suspicious/noExplicitAny: test double for the tRPC opts
		await expect(middleware.use(opts as any)).rejects.toBeInstanceOf(TRPCError);
	});

	it("rejects a user who is not a member of the active organization", async () => {
		const opts = fakeOpts(
			{ session: { activeOrganizationId: a.agencyId } },
			stranger,
		);
		// biome-ignore lint/suspicious/noExplicitAny: test double for the tRPC opts
		await expect(middleware.use(opts as any)).rejects.toBeInstanceOf(TRPCError);
	});

	it("passes a real member through with agencyId and role on the context", async () => {
		const opts = fakeOpts(
			{ session: { activeOrganizationId: a.agencyId } },
			a.ownerUserId,
		);
		// biome-ignore lint/suspicious/noExplicitAny: test double for the tRPC opts
		const result = (await middleware.use(opts as any)) as unknown as {
			ctx: { agencyId: string; role: string };
		};

		expect(result.ctx.agencyId).toBe(a.agencyId);
		expect(result.ctx.role).toBe("owner");
	});
});
