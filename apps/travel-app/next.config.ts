import { loadRootEnv } from "@crm/env";
import type { NextConfig } from "next";

loadRootEnv();

const apiUrl =
	process.env.TRAVEL_API_URL ??
	process.env.NEXT_PUBLIC_TRAVEL_API_URL ??
	"http://localhost:3011";

const allowedDevOrigins = (process.env.TRAVEL_APP_URL ?? "")
	.split(",")
	.flatMap((origin) => {
		try {
			return [new URL(origin.trim()).hostname];
		} catch {
			return [];
		}
	});

const nextConfig: NextConfig = {
	allowedDevOrigins,

	env: {
		NEXT_PUBLIC_TRAVEL_API_URL: apiUrl,
	},

	transpilePackages: ["@crm/ui", "@travel/auth", "@travel/db"],

	serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "**.blob.vercel-storage.com" },
		],
	},

	cacheComponents: true,
	partialPrefetching: true,
};

export default nextConfig;
