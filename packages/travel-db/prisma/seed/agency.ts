import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { db } from "../../src/client";
import { COUNTER_KIND } from "../../src/folio";
import type { SeedAgencySpec } from "./config";
import { SEED_PASSWORD } from "./config";
import type { AgencyBag, SeededUser } from "./context";
import { daysFromNow } from "./random";

const SCRYPT_PARAMS = { N: 16384, r: 16, p: 1, keylen: 64 } as const;

function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	return new Promise((resolve, reject) => {
		scrypt(
			password.normalize("NFKC"),
			salt,
			SCRYPT_PARAMS.keylen,
			{
				N: SCRYPT_PARAMS.N,
				r: SCRYPT_PARAMS.r,
				p: SCRYPT_PARAMS.p,
				maxmem: 128 * SCRYPT_PARAMS.N * SCRYPT_PARAMS.r * 2,
			},
			(error, derivedKey) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(`${salt}:${derivedKey.toString("hex")}`);
			},
		);
	});
}

export async function seedAgency(spec: SeedAgencySpec): Promise<AgencyBag> {
	const agencyId = randomUUID();

	await db.organization.create({
		data: {
			id: agencyId,
			name: spec.name,
			slug: spec.slug,
			createdAt: daysFromNow(-240),
		},
	});

	const users: SeededUser[] = [];
	const passwordHash = await hashPassword(SEED_PASSWORD);

	for (const userSpec of spec.users) {
		const userId = randomUUID();
		await db.user.create({
			data: {
				id: userId,
				name: userSpec.name,
				email: userSpec.email,
				emailVerified: true,
			},
		});
		await db.member.create({
			data: {
				id: randomUUID(),
				organizationId: agencyId,
				userId,
				role: userSpec.role,
				createdAt: daysFromNow(-235),
			},
		});
		await db.account.create({
			data: {
				id: randomUUID(),
				accountId: userId,
				providerId: "credential",
				userId,
				password: passwordHash,
				createdAt: daysFromNow(-235),
			},
		});
		users.push({
			id: userId,
			key: userSpec.key,
			name: userSpec.name,
			email: userSpec.email,
			role: userSpec.role,
		});
	}

	const owner = users.find((user) => user.role === "owner") as SeededUser;

	await db.invitation.create({
		data: {
			id: randomUUID(),
			organizationId: agencyId,
			email: spec.pendingInvite,
			role: "agent",
			status: "pending",
			expiresAt: daysFromNow(7),
			inviterId: owner.id,
		},
	});

	await db.agencySettings.create({
		data: {
			agencyId,
			baseCurrency: spec.baseCurrency,
			timezone: spec.timezone,
			quotePrefix: spec.quotePrefix,
			bookingPrefix: spec.bookingPrefix,
			legalName: spec.legalName,
			taxId: spec.taxId,
			phone: spec.phone,
			email: spec.email,
			logoUrl: spec.logoUrl,
			defaultTerms: spec.defaultTerms,
			defaultCommissionBasis: "MARGIN",
			defaultCommissionRate: "0.1000",
		},
	});

	await db.agencyCounter.createMany({
		data: [
			{ agencyId, kind: COUNTER_KIND.quote, value: 0 },
			{ agencyId, kind: COUNTER_KIND.booking, value: 0 },
		],
	});

	return {
		spec,
		agencyId,
		base: spec.baseCurrency,
		users,
		suppliers: [],
		customers: [],
		travelers: [],
		quotes: [],
		bookings: [],
		quoteSeq: 0,
		bookingSeq: 0,
		shareLinks: [],
	};
}

export async function finaliseCounters(bag: AgencyBag): Promise<void> {
	await db.agencyCounter.update({
		where: {
			agencyId_kind: { agencyId: bag.agencyId, kind: COUNTER_KIND.quote },
		},
		data: { value: bag.quoteSeq },
	});
	await db.agencyCounter.update({
		where: {
			agencyId_kind: { agencyId: bag.agencyId, kind: COUNTER_KIND.booking },
		},
		data: { value: bag.bookingSeq },
	});
}
