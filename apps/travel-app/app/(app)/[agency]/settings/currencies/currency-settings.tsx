"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const CELL = "px-3 py-2.5 align-middle";

const RATE_COLUMNS: SimpleTableColumn[] = [
	{ id: "currency", header: "Currency" },
	{ id: "rate", header: "Rate", width: "w-32", align: "right" },
	{ id: "source", header: "Source", width: "w-28" },
	{ id: "asOf", header: "As of", width: "w-24", align: "right" },
	{ id: "actions", srLabel: "Actions", width: "w-20" },
];

export function CurrencySettings() {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const baseId = useId();
	const rateCurrencyId = useId();
	const rateValueId = useId();

	const [draftCurrency, setDraftCurrency] = useState("");
	const [draftRate, setDraftRate] = useState("");

	const settings = useQuery(trpc.currency.settings.queryOptions());
	const invalidate = () => cache.currency();

	const setBase = useMutation(
		trpc.currency.setBaseCurrency.mutationOptions({
			onSuccess: async (next) => {
				await invalidate();
				toast.success(`Every total is now reported in ${next.baseCurrency}.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setRate = useMutation(
		trpc.currency.setManualRate.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setDraftCurrency("");
				setDraftRate("");
				toast.success("Rate saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const removeRate = useMutation(
		trpc.currency.removeManualRate.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Rate removed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const refresh = useMutation(
		trpc.currency.refreshRates.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Rates refreshed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!settings.data) return null;

	const { baseCurrency, refreshedAt, rates, unconverted, catalog, canManage } =
		settings.data;

	const busy =
		!canManage ||
		setBase.isPending ||
		setRate.isPending ||
		removeRate.isPending ||
		refresh.isPending;

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Base currency</CardTitle>
					<CardDescription>
						Every total, chart and margin is expressed in this currency. Each
						line keeps the currency it was quoted in.
					</CardDescription>
				</CardHeader>

				<CardContent>
					<Field>
						<FieldLabel htmlFor={baseId}>Report totals in</FieldLabel>
						<Select
							value={baseCurrency}
							disabled={busy}
							onValueChange={(currency) => setBase.mutate({ currency })}
						>
							<SelectTrigger id={baseId} className="w-full max-w-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{catalog.map((entry) => (
									<SelectItem key={entry.code} value={entry.code}>
										{entry.code} · {entry.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldDescription>
							{canManage
								? "Lines already converted keep their frozen rate. Lines with no rate are filled at today's rate."
								: "Only an owner or an admin can change how money is reported."}
						</FieldDescription>
					</Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Exchange rates</CardTitle>
					<CardDescription>
						How many {baseCurrency} one unit of each currency buys. Fetched from
						open.er-api.com; a rate you enter here wins.
					</CardDescription>
					<CardAction>
						<Button
							variant="contrast"
							size="sm"
							disabled={busy}
							onClick={() => refresh.mutate()}
						>
							{refresh.isPending ? <Spinner data-icon="inline-start" /> : null}
							Refresh
						</Button>
					</CardAction>
				</CardHeader>

				<CardContent>
					<form
						className="flex flex-wrap items-end gap-3"
						onSubmit={(event) => {
							event.preventDefault();
							const rate = Number.parseFloat(draftRate);
							if (!Number.isFinite(rate) || rate <= 0) {
								toast.error("A rate has to be a number greater than zero.");
								return;
							}
							setRate.mutate({ currency: draftCurrency, rate });
						}}
					>
						<Field className="w-48">
							<FieldLabel htmlFor={rateCurrencyId}>Currency</FieldLabel>
							<Select
								value={draftCurrency}
								disabled={busy}
								onValueChange={setDraftCurrency}
							>
								<SelectTrigger id={rateCurrencyId} className="w-full">
									<SelectValue placeholder="Pick one" />
								</SelectTrigger>
								<SelectContent>
									{catalog
										.filter((entry) => entry.code !== baseCurrency)
										.map((entry) => (
											<SelectItem key={entry.code} value={entry.code}>
												{entry.code} · {entry.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</Field>

						<Field className="w-48">
							<FieldLabel htmlFor={rateValueId}>
								1 {draftCurrency || "unit"} = ? {baseCurrency}
							</FieldLabel>
							<Input
								id={rateValueId}
								value={draftRate}
								inputMode="decimal"
								placeholder="1.09"
								disabled={busy}
								onChange={(event) => setDraftRate(event.target.value)}
							/>
						</Field>

						<Button
							type="submit"
							disabled={busy || draftCurrency === "" || draftRate.trim() === ""}
						>
							{setRate.isPending ? <Spinner data-icon="inline-start" /> : null}
							Save rate
						</Button>
					</form>
				</CardContent>

				{rates.length === 0 ? (
					<CardTableEmpty>
						No rates yet. Refresh to fetch them, or enter one by hand.
					</CardTableEmpty>
				) : (
					<SimpleTable columns={RATE_COLUMNS}>
						{rates.map((rate) => (
							<SimpleTableRow key={rate.currency}>
								<TableCell className={CELL}>
									<span className="font-medium">{rate.currency}</span>
									<span className="text-muted-foreground">
										{rate.name ? ` · ${rate.name}` : ""}
									</span>
								</TableCell>
								<TableCell className={`${CELL} text-right tabular-nums`}>
									{rate.rate}
								</TableCell>
								<TableCell className={CELL}>
									<StatusIndicator
										size="sm"
										tone={rate.source === "MANUAL" ? "warning" : "success"}
										label={rate.source === "MANUAL" ? "By hand" : "Fetched"}
									/>
								</TableCell>
								<TableCell
									className={`${CELL} text-right text-muted-foreground`}
								>
									<LocalRelativeTime date={rate.asOf} />
								</TableCell>
								<TableCell className={`${CELL} text-right`}>
									{rate.source === "MANUAL" ? (
										<Button
											variant="ghost"
											size="sm"
											disabled={busy}
											onClick={() =>
												removeRate.mutate({ currency: rate.currency })
											}
										>
											Remove
										</Button>
									) : null}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Lines without a rate</CardTitle>
					<CardDescription>
						{unconverted.count === 0
							? "Every line with an amount can be converted into the base currency."
							: `${formatCount(unconverted.count, "line")} in ${unconverted.currencies.join(", ")} cannot be converted, so ${unconverted.count === 1 ? "it is" : "they are"} left out of every total.`}
						{refreshedAt ? (
							<>
								{" "}
								Rates last fetched <LocalRelativeTime date={refreshedAt} />.
							</>
						) : null}
					</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}
