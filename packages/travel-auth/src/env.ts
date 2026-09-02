import "@crm/env/load";

const DEFAULT_API_URL = "http://localhost:3011";
const DEFAULT_APP_URL = "http://localhost:3010";

const optional = (key: string): string | undefined => {
	const value = process.env[key];
	return value && value.length > 0 ? value : undefined;
};

const pair = (
	idKey: string,
	secretKey: string,
): { clientId: string; clientSecret: string } | undefined => {
	const clientId = optional(idKey);
	const clientSecret = optional(secretKey);

	if (!clientId || !clientSecret) {
		if (clientId || clientSecret) {
			throw new Error(`${idKey} and ${secretKey} must be set together.`);
		}
		return undefined;
	}

	return { clientId, clientSecret };
};

const googleCredentials = ():
	| { clientId: string; clientSecret: string }
	| undefined => pair("TRAVEL_GOOGLE_CLIENT_ID", "TRAVEL_GOOGLE_CLIENT_SECRET");

const apiUrl = optional("TRAVEL_API_URL") ?? DEFAULT_API_URL;

const appUrls = (optional("TRAVEL_APP_URL") ?? DEFAULT_APP_URL)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const appUrl = appUrls[0] ?? DEFAULT_APP_URL;

export const env = {
	apiUrl,
	appUrl,
	secret: optional("TRAVEL_BETTER_AUTH_SECRET"),
	google: googleCredentials(),
	cookieDomain: optional("TRAVEL_AUTH_COOKIE_DOMAIN"),
	trustedOrigins: [...new Set([...appUrls, apiUrl])],
	isProduction: process.env.NODE_ENV === "production",
} as const;

export function isGoogleConfigured(): boolean {
	return env.google !== undefined;
}

export { apiUrl, appUrl };
