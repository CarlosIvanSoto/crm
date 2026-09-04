import { AUTH_COOKIE_PREFIX } from "@travel/auth/cookies";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { readAgencyGate } from "@/lib/agency-gate";
import { agencyUrl } from "@/lib/agency-url";

const SIGN_IN_PATH = "/sign-in";

const NEW_AGENCY_PATH = "/new-agency";

const PUBLIC = ["/sign-in", "/sign-up", "/accept"];

const SECTIONS = [
	"/customers",
	"/travelers",
	"/suppliers",
	"/quotes",
	"/bookings",
	"/payments",
	"/commissions",
	"/tasks",
	"/settings",
];

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (isPublic(pathname)) return NextResponse.next();

	if (
		getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX }) === null
	) {
		return NextResponse.redirect(new URL(SIGN_IN_PATH, request.nextUrl));
	}

	const agency = await readAgencyGate(request);

	if (agency.gate === "required") return sendTo(NEW_AGENCY_PATH, request);

	if (agency.gate !== "settled" || !agency.slug) return NextResponse.next();

	return sendTo(appPath(pathname, agency.slug), request);
}

function appPath(pathname: string, slug: string): string {
	if (pathname === "/" || pathname === NEW_AGENCY_PATH) {
		return agencyUrl(slug);
	}

	if (SECTIONS.some((section) => isUnder(pathname, section))) {
		return agencyUrl(slug, pathname);
	}

	const [first, ...rest] = pathname.slice(1).split("/");

	if (first === slug) return pathname;

	return agencyUrl(slug, rest.length ? `/${rest.join("/")}` : "/");
}

function isUnder(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublic(pathname: string): boolean {
	return PUBLIC.some((prefix) => isUnder(pathname, prefix));
}

function sendTo(path: string, request: NextRequest): NextResponse {
	if (request.nextUrl.pathname === path) return NextResponse.next();

	const url = new URL(path, request.nextUrl);
	url.search = request.nextUrl.search;

	return NextResponse.redirect(url);
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|webmanifest)$).*)",
	],
};
