import type { NextRequest } from "next/server";
import { z } from "zod";
import { API_URL } from "@/lib/env";

const GATE_TIMEOUT_MS = 2_000;

export type Gate = "settled" | "required" | "unknown";

export type AgencyGate = { gate: Gate; slug: string | null };

const procedureResult = z
	.object({
		result: z
			.object({
				data: z
					.object({ slug: z.string().min(1).nullable().catch(null) })
					.catch({ slug: null }),
			})
			.catch({ data: { slug: null } }),
	})
	.catch({ result: { data: { slug: null } } });

type Fetched =
	| { kind: "profile"; slug: string | null }
	| { kind: "forbidden" }
	| { kind: "unknown" };

async function fetchAgencyProfile(request: NextRequest): Promise<Fetched> {
	const cookie = request.headers.get("cookie");

	if (!cookie) return { kind: "unknown" };

	try {
		const response = await fetch(`${API_URL}/api/trpc/agency.profile`, {
			headers: { cookie },
			cache: "no-store",
			signal: AbortSignal.timeout(GATE_TIMEOUT_MS),
		});

		if (response.status === 401 || response.status === 403) {
			return { kind: "forbidden" };
		}

		if (!response.ok) return { kind: "unknown" };

		const parsed = procedureResult.parse(await response.json());
		return { kind: "profile", slug: parsed.result.data.slug };
	} catch {
		return { kind: "unknown" };
	}
}

export async function readAgencyGate(
	request: NextRequest,
): Promise<AgencyGate> {
	const fetched = await fetchAgencyProfile(request);

	if (fetched.kind === "forbidden") return { gate: "required", slug: null };
	if (fetched.kind === "unknown") return { gate: "unknown", slug: null };

	return fetched.slug
		? { gate: "settled", slug: fetched.slug }
		: { gate: "required", slug: null };
}
