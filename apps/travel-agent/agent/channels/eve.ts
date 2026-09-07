import {
	type AuthFn,
	extractBearerToken,
	localDev,
	vercelOidc,
	verifyJwtHmac,
	withAuthChallenges,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { noteConversationActivity } from "../lib/conversations";

export const BRIDGE_ISSUER = "travel-app";
export const BRIDGE_AUDIENCE = "travel-agent";

export function advisorFromTravelApp(secret: string): AuthFn<Request> {
	return withAuthChallenges(
		async (request: Request) => {
			const result = await verifyJwtHmac(
				extractBearerToken(request.headers.get("authorization")),
				{
					algorithm: "HS256",
					audiences: [BRIDGE_AUDIENCE],
					issuer: BRIDGE_ISSUER,
					secret,
				},
			);

			if (!result.ok) return null;

			const claims = result.sessionAuth;
			const userId = claims.subject;
			if (!userId) return null;

			return {
				attributes: claims.attributes ?? {},
				authenticator: "travel-app",
				principalId: userId,
				principalType: "user" as const,
			};
		},
		[{ scheme: "Bearer" }],
	);
}

const secret = process.env.TRAVEL_AGENT_BRIDGE_SECRET;

export default eveChannel({
	auth: [
		...(secret ? [advisorFromTravelApp(secret)] : []),
		vercelOidc(),
		localDev(),
	],
	events: {
		async "message.completed"(_data, _channel, ctx) {
			await noteConversationActivity(ctx.session.id);
		},
	},
});
