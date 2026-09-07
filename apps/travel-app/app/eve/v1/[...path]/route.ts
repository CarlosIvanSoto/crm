import { agencyDb, db } from "@travel/db";
import { connection } from "next/server";
import {
	bridgeConfigured,
	mintBridgeToken,
	TRAVEL_AGENT_URL,
} from "@/lib/agent-bridge";
import { getSession } from "@/lib/session";

async function handler(request: Request): Promise<Response> {
	await connection();

	if (!bridgeConfigured()) {
		return Response.json(
			{
				error: "The quote follow-up agent is not configured for this install.",
			},
			{ status: 503 },
		);
	}

	const session = await getSession();
	if (!session) {
		return Response.json({ error: "Not signed in." }, { status: 401 });
	}

	const agencyId = session.session.activeOrganizationId;
	if (!agencyId) {
		return Response.json(
			{ error: "Choose an agency before you continue." },
			{ status: 403 },
		);
	}

	const url = new URL(request.url);
	const target = `${TRAVEL_AGENT_URL}${url.pathname}${url.search}`;

	const headers = new Headers(request.headers);

	for (const header of [
		"host",
		"cookie",
		"x-forwarded-host",
		"x-forwarded-proto",
		"x-forwarded-for",
		"forwarded",
		"transfer-encoding",
		"connection",
		"keep-alive",
		"content-length",
		"expect",
	]) {
		headers.delete(header);
	}

	const quoteId = request.headers.get("x-quote-id");
	headers.delete("x-quote-id");

	if (!quoteId) {
		return Response.json({ error: "No quote was named." }, { status: 400 });
	}

	const quote = await agencyDb(db, agencyId).quote.findFirst({
		where: { id: quoteId },
		select: { id: true },
	});
	if (!quote) {
		return Response.json({ error: "Quote not found." }, { status: 404 });
	}

	headers.set(
		"authorization",
		`Bearer ${await mintBridgeToken(session.user.id, { agencyId, quoteId })}`,
	);

	const init: RequestInit & { duplex?: "half" } = {
		method: request.method,
		headers,
		redirect: "manual",
		signal: request.signal,
	};

	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = request.body;
		init.duplex = "half";
	}

	let upstream: Response;
	try {
		upstream = await fetch(target, init);
	} catch (error) {
		return Response.json(
			{
				error: "The quote follow-up agent is not reachable.",
				detail: error instanceof Error ? error.message : String(error),
			},
			{ status: 502 },
		);
	}

	const responseHeaders = new Headers(upstream.headers);
	for (const header of [
		"transfer-encoding",
		"connection",
		"content-encoding",
		"content-length",
	]) {
		responseHeaders.delete(header);
	}

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders,
	});
}

export {
	handler as DELETE,
	handler as GET,
	handler as HEAD,
	handler as OPTIONS,
	handler as PATCH,
	handler as POST,
	handler as PUT,
};
