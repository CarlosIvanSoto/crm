"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { DashboardRow } from "@crm/ui/components/dashboard";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { TableCell } from "@crm/ui/components/table";
import { formatAmount, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { canSeeMargins } from "@/lib/roles";
import { useTRPC } from "@/lib/trpc/client";

const CELL = "px-3 py-2.5 align-middle";

const ADVISOR_COLUMNS: SimpleTableColumn[] = [
	{ id: "advisor", header: "Advisor" },
	{ id: "commissions", header: "Rows", width: "w-20", align: "right" },
	{ id: "commissionBase", header: "Commission", width: "w-32", align: "right" },
	{
		id: "marginBase",
		header: "Margin",
		width: "w-32",
		align: "right",
		className: "hidden md:table-cell",
	},
];

const SUPPLIER_COLUMNS: SimpleTableColumn[] = [
	{ id: "supplier", header: "Supplier" },
	{ id: "items", header: "Lines", width: "w-20", align: "right" },
	{ id: "costBase", header: "Cost", width: "w-32", align: "right" },
	{
		id: "sellBase",
		header: "Sell",
		width: "w-32",
		align: "right",
		className: "hidden md:table-cell",
	},
	{ id: "defaultRate", header: "Rate", width: "w-24", align: "right" },
];

export function CommissionsReports() {
	const trpc = useTRPC();
	const me = useQuery(trpc.users.me.queryOptions());
	const seeMargins = canSeeMargins(me.data?.role ?? null);

	const advisor = useQuery(trpc.commissions.byAdvisor.queryOptions());
	const supplier = useQuery({
		...trpc.commissions.bySupplier.queryOptions(),
		enabled: seeMargins,
	});

	if (!advisor.data) {
		return (
			<div className="flex flex-1 justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const advisorRows = [...advisor.data.rows].sort(
		(a, b) => b.commissionBase - a.commissionBase,
	);
	const advisorCurrency = advisor.data.baseCurrency ?? "usd";
	const supplierRows = supplier.data
		? [...supplier.data.rows].sort((a, b) => b.costBase - a.costBase)
		: [];
	const supplierCurrency = supplier.data?.baseCurrency ?? "usd";

	return (
		<DashboardRow split="even">
			<Card className="min-w-0">
				<CardHeader>
					<CardTitle>By advisor</CardTitle>
					<CardDescription>
						Commission owed per advisor, in {advisorCurrency}
					</CardDescription>
				</CardHeader>
				<CardPanel>
					{advisorRows.length === 0 ? (
						<CardPanelEmpty>No commissions yet.</CardPanelEmpty>
					) : (
						<SimpleTable
							variant="panel"
							surface="page"
							columns={ADVISOR_COLUMNS}
						>
							{advisorRows.map((row) => (
								<SimpleTableRow key={row.userId}>
									<TableCell className={CELL}>
										<span className="truncate font-medium">{row.userName}</span>
										{row.missingRate > 0 ? (
											<span className="ml-2 text-muted-foreground text-xs">
												{row.missingRate} without a rate
											</span>
										) : null}
									</TableCell>
									<TableCell className={`${CELL} text-right tabular-nums`}>
										{row.commissions}
									</TableCell>
									<TableCell className={`${CELL} text-right tabular-nums`}>
										{formatAmount(row.commissionBase, advisorCurrency)}
									</TableCell>
									<TableCell
										className={`${CELL} hidden text-right tabular-nums md:table-cell`}
									>
										{row.marginBase === null ? (
											<EmptyCellValue />
										) : (
											formatAmount(row.marginBase, advisorCurrency)
										)}
									</TableCell>
								</SimpleTableRow>
							))}
						</SimpleTable>
					)}
				</CardPanel>
			</Card>

			<Card className="min-w-0">
				<CardHeader>
					<CardTitle>By supplier</CardTitle>
					<CardDescription>
						{seeMargins
							? `Booked cost and sell per supplier, in ${supplierCurrency}`
							: "Only an owner, admin or accountant sees this"}
					</CardDescription>
				</CardHeader>
				<CardPanel>
					{!seeMargins ? (
						<CardPanelEmpty>Not available for your role.</CardPanelEmpty>
					) : supplierRows.length === 0 ? (
						<CardPanelEmpty>No booked lines yet.</CardPanelEmpty>
					) : (
						<SimpleTable
							variant="panel"
							surface="page"
							columns={SUPPLIER_COLUMNS}
						>
							{supplierRows.map((row) => (
								<SimpleTableRow key={row.supplierId}>
									<TableCell className={CELL}>
										<span className="truncate font-medium">
											{row.supplierName}
										</span>
									</TableCell>
									<TableCell className={`${CELL} text-right tabular-nums`}>
										{row.items}
									</TableCell>
									<TableCell className={`${CELL} text-right tabular-nums`}>
										{formatAmount(row.costBase, supplierCurrency)}
									</TableCell>
									<TableCell
										className={`${CELL} hidden text-right tabular-nums md:table-cell`}
									>
										{formatAmount(row.sellBase, supplierCurrency)}
									</TableCell>
									<TableCell className={`${CELL} text-right tabular-nums`}>
										{row.defaultRate === null ? (
											<EmptyCellValue />
										) : (
											formatPercent(row.defaultRate)
										)}
									</TableCell>
								</SimpleTableRow>
							))}
						</SimpleTable>
					)}
				</CardPanel>
			</Card>
		</DashboardRow>
	);
}
