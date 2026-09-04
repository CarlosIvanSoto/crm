"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { DashboardRow, StatGroup } from "@crm/ui/components/dashboard";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { StatCard } from "@crm/ui/components/stat-card";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import {
	formatAmount,
	formatAmountCompact,
	formatCount,
} from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { LocalRelativeTime } from "@/components/local-date-time";
import { usePrefetchRecord } from "@/components/travel/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/travel/record-sheet/record-stack";
import { bookingStatusLabel } from "@/components/travel/status-labels";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTRPC } from "@/lib/trpc/client";
import { overviewParsers } from "./overview-search-params";

const CELL = "px-3 py-2.5 align-middle";

const DEPARTURE_COLUMNS: SimpleTableColumn[] = [
	{ id: "folio", header: "Booking" },
	{
		id: "destination",
		header: "Destination",
		width: "w-40",
		className: "hidden md:table-cell",
	},
	{
		id: "pax",
		header: "Travelers",
		width: "w-24",
		align: "right",
		className: "hidden sm:table-cell",
	},
	{ id: "start", header: "Departs", width: "w-28", align: "right" },
];

const ADVISOR_COLUMNS: SimpleTableColumn[] = [
	{ id: "advisor", header: "Advisor" },
	{ id: "bookings", header: "Bookings", width: "w-24", align: "right" },
	{ id: "commission", header: "Commission", width: "w-32", align: "right" },
];

export function DashboardSummary() {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();

	const [scope] = useQueryState(
		SEARCH_PARAM.overview.scope,
		overviewParsers[SEARCH_PARAM.overview.scope],
	);

	const summaryQuery = useQuery({
		...trpc.dashboard.summary.queryOptions({ scope }),
		placeholderData: (previous) => previous,
	});
	const advisorQuery = useQuery(trpc.commissions.byAdvisor.queryOptions());

	const summary = summaryQuery.data;

	if (!summary) {
		return (
			<div className="flex flex-1 justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const { month, overdue, departures, tasks, unconverted, baseCurrency } =
		summary;
	const money = (value: number) => formatAmountCompact(value, baseCurrency);
	const exact = (value: number) => formatAmount(value, baseCurrency);

	return (
		<div className="flex flex-col gap-6">
			<StatGroup>
				<StatCard
					label="Sold this month"
					value={money(month.soldBase)}
					description={`${formatCount(month.bookings, "booking")} · cost ${money(month.costBase)}`}
				/>
				<StatCard
					label="Margin this month"
					value={month.marginBase === null ? "—" : money(month.marginBase)}
					description={
						month.marginBase === null
							? "Only an owner, admin or accountant sees margin"
							: `${exact(month.soldBase)} sold − ${exact(month.costBase)} cost`
					}
				/>
				<StatCard
					label="Overdue"
					value={money(overdue.amountBase)}
					description={
						overdue.count === 0
							? "Nothing past due"
							: `${formatCount(overdue.count, "charge")} past due`
					}
				/>
				<StatCard
					label={`Departures (${departures.windowDays}d)`}
					value={String(departures.count)}
					description={
						departures.count === 0
							? "No trips leave in the next month"
							: "Trips that leave in the next 30 days"
					}
				/>
			</StatGroup>

			{unconverted.count > 0 ? (
				<p className="text-muted-foreground text-xs">
					Every figure above is in {baseCurrency}.{" "}
					{formatCount(unconverted.count, "line")} in{" "}
					{unconverted.currencies.join(", ")}{" "}
					{unconverted.count === 1 ? "has" : "have"} no rate and{" "}
					{unconverted.count === 1 ? "is" : "are"} left out.
				</p>
			) : null}

			{overdue.missingRate > 0 ? (
				<p className="text-muted-foreground text-xs">
					{formatCount(overdue.missingRate, "overdue charge")}{" "}
					{overdue.missingRate === 1 ? "has" : "have"} no rate and{" "}
					{overdue.missingRate === 1 ? "is" : "are"} not in the total above.
				</p>
			) : null}

			<DashboardRow split="even">
				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>Upcoming departures</CardTitle>
						<CardDescription>
							The next trips to leave, soonest first
						</CardDescription>
					</CardHeader>
					<CardPanel>
						{departures.items.length === 0 ? (
							<CardPanelEmpty>
								Nothing leaves in the next 30 days.
							</CardPanelEmpty>
						) : (
							<SimpleTable
								variant="panel"
								surface="page"
								columns={DEPARTURE_COLUMNS}
							>
								{departures.items.map((trip) => (
									<SimpleTableRow
										key={trip.id}
										clickable
										onMouseEnter={() =>
											prefetchRecord({ kind: "booking", id: trip.id })
										}
										onClick={() => openRecord({ kind: "booking", id: trip.id })}
									>
										<TableCell className={CELL}>
											<span className="flex min-w-0 flex-col">
												<span className="truncate font-medium">
													{trip.folio}
												</span>
												<span className="truncate text-muted-foreground">
													{trip.customerName} ·{" "}
													{bookingStatusLabel(trip.status)}
												</span>
											</span>
										</TableCell>
										<TableCell
											className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
										>
											{trip.destination ?? <EmptyCellValue />}
										</TableCell>
										<TableCell
											className={`${CELL} hidden text-right tabular-nums sm:table-cell`}
										>
											{trip.travelers}
										</TableCell>
										<TableCell
											className={`${CELL} text-right text-muted-foreground`}
										>
											<LocalRelativeTime date={trip.travelStartDate} />
										</TableCell>
									</SimpleTableRow>
								))}
							</SimpleTable>
						)}
					</CardPanel>
				</Card>

				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>Overdue charges</CardTitle>
						<CardDescription>
							Customer charges past their due date, in {baseCurrency}
						</CardDescription>
					</CardHeader>
					<CardPanel>
						<div className="flex flex-col gap-2 px-5 py-6 md:px-6">
							<span className="font-medium text-3xl tracking-tight tabular-nums">
								{money(overdue.amountBase)}
							</span>
							<StatusIndicator
								tone={overdue.count === 0 ? "success" : "error"}
								label={
									overdue.count === 0
										? "Everything scheduled is still to come"
										: `${formatCount(overdue.count, "charge")} past due`
								}
							/>
							{overdue.missingRate > 0 ? (
								<span className="text-muted-foreground text-xs">
									{formatCount(overdue.missingRate, "charge")} without a rate
									not counted
								</span>
							) : null}
						</div>
					</CardPanel>
				</Card>
			</DashboardRow>

			<DashboardRow split="even">
				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>Top advisors</CardTitle>
						<CardDescription>
							Commission owed, most first, in {baseCurrency}
						</CardDescription>
					</CardHeader>
					<CardPanel>
						{(advisorQuery.data?.rows.length ?? 0) === 0 ? (
							<CardPanelEmpty>No commissions yet.</CardPanelEmpty>
						) : (
							<SimpleTable
								variant="panel"
								surface="page"
								columns={ADVISOR_COLUMNS}
							>
								{[...(advisorQuery.data?.rows ?? [])]
									.sort((a, b) => b.commissionBase - a.commissionBase)
									.slice(0, 6)
									.map((row) => (
										<SimpleTableRow key={row.userId}>
											<TableCell className={CELL}>
												<span className="truncate font-medium">
													{row.userName}
												</span>
												{row.missingRate > 0 ? (
													<span className="ml-2 text-muted-foreground text-xs">
														{row.missingRate} without a rate
													</span>
												) : null}
											</TableCell>
											<TableCell className={`${CELL} text-right tabular-nums`}>
												{row.bookings}
											</TableCell>
											<TableCell className={`${CELL} text-right tabular-nums`}>
												{exact(row.commissionBase)}
											</TableCell>
										</SimpleTableRow>
									))}
							</SimpleTable>
						)}
					</CardPanel>
				</Card>

				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>My tasks</CardTitle>
						<CardDescription>
							Open tasks assigned to you, and how many are past due
						</CardDescription>
					</CardHeader>
					<CardPanel>
						<div className="flex flex-col gap-2 px-5 py-6 md:px-6">
							<span className="font-medium text-3xl tracking-tight tabular-nums">
								{tasks.open}
							</span>
							<StatusIndicator
								tone={tasks.overdue === 0 ? "success" : "error"}
								label={
									tasks.overdue === 0
										? "Nothing past due"
										: `${formatCount(tasks.overdue, "task")} past due`
								}
							/>
						</div>
					</CardPanel>
				</Card>
			</DashboardRow>
		</div>
	);
}
