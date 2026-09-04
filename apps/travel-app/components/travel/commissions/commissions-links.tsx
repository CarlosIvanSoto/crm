"use client";

import { Button } from "@crm/ui/components/button";
import Link from "next/link";
import { Suspense } from "react";
import { useAgencyUrl } from "@/lib/use-agency-url";

function LinkButton({ path, label }: { path: string; label: string }) {
	const agencyUrl = useAgencyUrl();
	return (
		<Button asChild variant="outline" size="sm">
			<Link href={agencyUrl(path)}>{label}</Link>
		</Button>
	);
}

function Fallback({ label }: { label: string }) {
	return (
		<Button variant="outline" size="sm" disabled>
			{label}
		</Button>
	);
}

export function ReportsLink() {
	return (
		<Suspense fallback={<Fallback label="Reports" />}>
			<LinkButton path="/commissions/reports" label="Reports" />
		</Suspense>
	);
}

export function BackToListLink() {
	return (
		<Suspense fallback={<Fallback label="Back to list" />}>
			<LinkButton path="/commissions" label="Back to list" />
		</Suspense>
	);
}
