import { afterEach, describe, expect, it } from "bun:test";
import {
	advisorFromTravelApp,
	BRIDGE_AUDIENCE,
	BRIDGE_ISSUER,
} from "../agent/channels/eve";
import { authorised } from "../agent/channels/travel";

const SECRET = "test-secret-at-least-long-enough-to-be-a-secret";

type BridgeHeader = { alg: string; typ: string };

type BridgeClaims = {
	iss: string;
	aud: string;
	sub: string | undefined;
	agencyId: string;
	quoteId: string;
	iat: number;
	nbf: number;
	exp: number;
};

async function mint(claims: BridgeClaims, secret = SECRET): Promise<string> {
	const encode = (value: BridgeClaims | BridgeHeader) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");

	const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(signingInput),
	);

	return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

function bearerRequest(token: string | null): Request {
	return new Request("https://agent.example.com/eve/v1/session", {
		method: "POST",
		headers: token ? { authorization: `Bearer ${token}` } : {},
	});
}

function claims(overrides: Partial<BridgeClaims> = {}): BridgeClaims {
	const now = Math.floor(Date.now() / 1000);
	return {
		iss: BRIDGE_ISSUER,
		aud: BRIDGE_AUDIENCE,
		sub: "advisor_123",
		agencyId: "agency_1",
		quoteId: "quote_1",
		iat: now,
		nbf: now - 5,
		exp: now + 120,
		...overrides,
	};
}

describe("advisorFromTravelApp", () => {
	const auth = advisorFromTravelApp(SECRET);

	it("resolves a valid token to the advisor, as a person", async () => {
		const result = await auth(bearerRequest(await mint(claims())));

		expect(result).toMatchObject({
			authenticator: "travel-app",
			principalId: "advisor_123",
			principalType: "user",
		});
	});

	it("carries the quote and agency for the tools to scope by", async () => {
		const session = await auth(bearerRequest(await mint(claims())));

		expect(session).toMatchObject({
			attributes: { agencyId: "agency_1", quoteId: "quote_1" },
		});
	});

	it("skips a request with no token", async () => {
		expect(await auth(bearerRequest(null))).toBeNull();
	});

	it("skips a token signed with the wrong secret", async () => {
		const forged = await mint(claims(), "not-the-shared-secret");
		expect(await auth(bearerRequest(forged))).toBeNull();
	});

	it("skips a token that names nobody", async () => {
		expect(
			await auth(bearerRequest(await mint(claims({ sub: undefined })))),
		).toBeNull();
	});

	it("skips a token minted for a different agent", async () => {
		expect(
			await auth(bearerRequest(await mint(claims({ aud: "someone-else" })))),
		).toBeNull();
	});

	it("skips an expired token", async () => {
		const now = Math.floor(Date.now() / 1000);
		const stale = await mint(claims({ iat: now - 600, exp: now - 300 }));
		expect(await auth(bearerRequest(stale))).toBeNull();
	});
});

describe("authorised (internal dispatch routes)", () => {
	const original = process.env.TRAVEL_AGENT_BRIDGE_SECRET;

	afterEach(() => {
		if (original === undefined) delete process.env.TRAVEL_AGENT_BRIDGE_SECRET;
		else process.env.TRAVEL_AGENT_BRIDGE_SECRET = original;
	});

	it("refuses every request when the secret is not set", () => {
		delete process.env.TRAVEL_AGENT_BRIDGE_SECRET;
		expect(authorised(bearerRequest("anything"))).toBe(false);
	});

	it("accepts the exact configured secret", () => {
		process.env.TRAVEL_AGENT_BRIDGE_SECRET = "the-real-secret";
		expect(authorised(bearerRequest("the-real-secret"))).toBe(true);
	});

	it("refuses a mismatched secret", () => {
		process.env.TRAVEL_AGENT_BRIDGE_SECRET = "the-real-secret";
		expect(authorised(bearerRequest("something-else"))).toBe(false);
	});

	it("refuses a request with no bearer header", () => {
		process.env.TRAVEL_AGENT_BRIDGE_SECRET = "the-real-secret";
		expect(authorised(bearerRequest(null))).toBe(false);
	});
});
