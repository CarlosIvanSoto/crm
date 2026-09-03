export function agencyUrl(slug: string, path = "/"): string {
	const suffix = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;

	return `/${slug}${suffix}`;
}
