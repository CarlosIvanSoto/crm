"use client";

import { useParams } from "next/navigation";
import { useCallback } from "react";
import { agencyUrl } from "@/lib/agency-url";

export function useAgencySlug(): string {
	const params = useParams<{ agency: string }>();
	return params.agency;
}

export function useAgencyUrl(): (path?: string) => string {
	const slug = useAgencySlug();
	return useCallback((path = "/") => agencyUrl(slug, path), [slug]);
}
