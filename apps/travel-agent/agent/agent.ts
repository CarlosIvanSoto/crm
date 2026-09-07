import "@crm/env/load";
import { defineAgent } from "eve";
import { TRAVEL_AGENT_MODEL } from "./lib/model-config";

export default defineAgent({
	model: TRAVEL_AGENT_MODEL,
	limits: {
		maxInputTokensPerSession: 200_000,
		maxOutputTokensPerSession: 20_000,
		sessionTimeoutMs: 10 * 60 * 1000,
	},
});
