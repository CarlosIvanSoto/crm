const ISSUER = "travel-app";
const AUDIENCE = "travel-agent";

const TTL_SECONDS = 120;

export const TRAVEL_AGENT_URL =
	process.env.TRAVEL_AGENT_URL ?? "http://127.0.0.1:2010";

export function bridgeConfigured(): boolean {
	return Boolean(process.env.TRAVEL_AGENT_BRIDGE_SECRET);
}

type BridgeClaims = {
	iss: string;
	aud: string;
	sub: string;
	agencyId: string;
	quoteId: string;
	iat: number;
	nbf: number;
	exp: number;
};

export async function mintBridgeToken(
	advisorId: string,
	record: { agencyId: string; quoteId: string },
): Promise<string> {
	const secret = process.env.TRAVEL_AGENT_BRIDGE_SECRET;
	if (!secret) throw new Error("TRAVEL_AGENT_BRIDGE_SECRET is not set.");

	const now = Math.floor(Date.now() / 1000);

	const header = { alg: "HS256", typ: "JWT" };
	const payload: BridgeClaims = {
		iss: ISSUER,
		aud: AUDIENCE,
		sub: advisorId,
		agencyId: record.agencyId,
		quoteId: record.quoteId,
		iat: now,
		nbf: now - 5,
		exp: now + TTL_SECONDS,
	};

	const signingInput = `${base64url(encode(JSON.stringify(header)))}.${base64url(
		encode(JSON.stringify(payload)),
	)}`;

	const key = await crypto.subtle.importKey(
		"raw",
		encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign("HMAC", key, encode(signingInput));

	return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

function encode(input: string) {
	return new TextEncoder().encode(input);
}

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}
