"use client";

import { Badge } from "@crm/ui/components/badge";
import { Separator } from "@crm/ui/components/separator";
import { useQuery } from "@tanstack/react-query";
import { LocalDay } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import { AcceptPanel } from "./accept-panel";
import { OptionCard } from "./option-card";
import { PrintButton } from "./print-button";

export function QuoteDocument({ token }: { token: string }) {
	const trpc = useTRPC();
	const { data, refetch } = useQuery(
		trpc.publicQuote.view.queryOptions({ token }),
	);

	if (!data) return null;

	const { agency, quote, customer, options } = data;

	return (
		<div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					{agency.logoUrl ? (
						// biome-ignore lint/performance/noImgElement: a customer-supplied logo URL, not a local asset
						<img
							src={agency.logoUrl}
							alt={agency.name}
							className="mb-3 h-10 w-auto object-contain"
						/>
					) : null}
					<h1 className="font-semibold text-2xl">
						{agency.legalName ?? agency.name}
					</h1>
					<p className="text-muted-foreground text-sm">
						{[agency.phone, agency.email].filter(Boolean).join(" · ") || null}
					</p>
				</div>
				<PrintButton />
			</div>

			<Separator className="my-6" />

			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-muted-foreground text-sm">Quote {quote.folio}</p>
					<h2 className="font-semibold text-xl">{customer.name}</h2>
				</div>
				<QuoteStatusBadge status={quote.status} expired={quote.expired} />
			</div>

			<dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
				<Detail label="Destination" value={quote.destination ?? "—"} />
				<Detail
					label="Travel dates"
					value={
						quote.travelStartDate ? (
							<LocalDay date={quote.travelStartDate} />
						) : (
							"—"
						)
					}
				/>
				<Detail
					label="Travelers"
					value={`${quote.paxAdults} adult${quote.paxAdults === 1 ? "" : "s"}${
						quote.paxChildren > 0 ? `, ${quote.paxChildren} child` : ""
					}`}
				/>
				<Detail
					label="Valid until"
					value={quote.validUntil ? <LocalDay date={quote.validUntil} /> : "—"}
				/>
			</dl>

			{quote.notes ? (
				<p className="mt-4 whitespace-pre-wrap text-sm">{quote.notes}</p>
			) : null}

			<h3 className="mt-8 mb-3 font-semibold text-lg">Options</h3>

			{quote.canAccept ? (
				<AcceptPanel
					token={token}
					options={options}
					onAccepted={() => refetch()}
				/>
			) : (
				<div className="grid gap-4 sm:grid-cols-2">
					{options.map((option) => (
						<OptionCard
							key={option.id}
							option={option}
							selected={option.id === quote.acceptedOptionId}
						/>
					))}
				</div>
			)}

			{quote.terms ? (
				<>
					<h3 className="mt-8 mb-2 font-semibold text-sm">Terms</h3>
					<p className="whitespace-pre-wrap text-muted-foreground text-xs">
						{quote.terms}
					</p>
				</>
			) : null}
		</div>
	);
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div>
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="font-medium">{value}</dd>
		</div>
	);
}

function QuoteStatusBadge({
	status,
	expired,
}: {
	status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
	expired: boolean;
}) {
	if (expired) return <Badge variant="destructive">Expired</Badge>;
	if (status === "ACCEPTED") return <Badge>Accepted</Badge>;
	if (status === "DECLINED")
		return <Badge variant="destructive">Declined</Badge>;
	return <Badge variant="outline">Awaiting your choice</Badge>;
}
