const DEFAULT_TRAVEL_AGENT_URL = "http://127.0.0.1:2010";

export interface Bridge {
	url(path: string): URL;
	secret: string;
}

/**
 * `TRAVEL_AGENT_BRIDGE_SECRET` unset means there is no bridge, not an open
 * one — the same rule the CRM agent bridge follows. Every caller has to say
 * what it does without the agent.
 */
export function bridge(): Bridge | null {
	const secret = process.env.TRAVEL_AGENT_BRIDGE_SECRET?.trim();
	if (!secret) return null;

	const base = process.env.TRAVEL_AGENT_URL?.trim() || DEFAULT_TRAVEL_AGENT_URL;

	return { url: (path) => new URL(path, base), secret };
}
