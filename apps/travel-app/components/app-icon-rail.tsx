"use client";

import Dashboard from "@carbon/icons-react/es/Dashboard";
import Delivery from "@carbon/icons-react/es/Delivery";
import DocumentBlank from "@carbon/icons-react/es/DocumentBlank";
import Money from "@carbon/icons-react/es/Money";
import Plane from "@carbon/icons-react/es/Plane";
import Settings from "@carbon/icons-react/es/Settings";
import Store from "@carbon/icons-react/es/Store";
import Task from "@carbon/icons-react/es/Task";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import Wallet from "@carbon/icons-react/es/Wallet";
import { Button } from "@crm/ui/components/button";
import type { CarbonIcon } from "@crm/ui/components/icon";
import { Icon } from "@crm/ui/components/icon";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useMobileNav } from "@/components/mobile-nav";
import { useAgencyUrl } from "@/lib/use-agency-url";

type RailItem = {
	title: string;
	href: string;
	icon: CarbonIcon;
	match: "exact" | "prefix";
};

const ITEMS: RailItem[] = [
	{ title: "Dashboard", href: "/", icon: Dashboard, match: "exact" },
	{
		title: "Customers",
		href: "/customers",
		icon: UserMultiple,
		match: "prefix",
	},
	{ title: "Travelers", href: "/travelers", icon: Plane, match: "prefix" },
	{ title: "Quotes", href: "/quotes", icon: DocumentBlank, match: "prefix" },
	{ title: "Bookings", href: "/bookings", icon: Delivery, match: "prefix" },
	{ title: "Suppliers", href: "/suppliers", icon: Store, match: "prefix" },
	{ title: "Payments", href: "/payments", icon: Money, match: "prefix" },
	{
		title: "Commissions",
		href: "/commissions",
		icon: Wallet,
		match: "prefix",
	},
	{ title: "Tasks", href: "/tasks", icon: Task, match: "prefix" },
	{ title: "Settings", href: "/settings", icon: Settings, match: "prefix" },
];

type ResolvedItem = RailItem & { url: string };

function isActive(item: ResolvedItem, pathname: string): boolean {
	return (
		pathname === item.url ||
		(item.match === "prefix" && pathname.startsWith(`${item.url}/`)) ||
		(item.match === "prefix" && pathname === item.url)
	);
}

function RailLink({ item, active }: { item: ResolvedItem; active: boolean }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					asChild
					variant="ghost"
					size="icon"
					className={cn(
						"text-muted-foreground",
						active &&
							"bg-muted text-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					<Link
						href={item.url}
						prefetch
						aria-current={active ? "page" : undefined}
						transitionTypes={["nav-lateral"]}
					>
						<Icon icon={item.icon} />
						<span className="sr-only">{item.title}</span>
					</Link>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="right">{item.title}</TooltipContent>
		</Tooltip>
	);
}

function MobileRailLink({
	item,
	active,
	onNavigate,
}: {
	item: ResolvedItem;
	active: boolean;
	onNavigate: () => void;
}) {
	return (
		<Button
			asChild
			variant="ghost"
			className={cn(
				"justify-start gap-3 text-muted-foreground",
				active &&
					"bg-muted text-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			<Link
				href={item.url}
				prefetch
				aria-current={active ? "page" : undefined}
				onClick={onNavigate}
			>
				<Icon icon={item.icon} />
				<span>{item.title}</span>
			</Link>
		</Button>
	);
}

export function AppIconRailFallback() {
	return (
		<nav
			aria-label="Primary"
			aria-busy="true"
			className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r py-3 md:flex [view-transition-name:app-rail]"
		>
			{ITEMS.map((item) => (
				<Button
					key={item.href}
					variant="ghost"
					size="icon"
					disabled
					className="text-muted-foreground"
				>
					<Icon icon={item.icon} />
					<span className="sr-only">{item.title}</span>
				</Button>
			))}
		</nav>
	);
}

export function AppIconRail() {
	const pathname = usePathname();
	const agencyUrl = useAgencyUrl();
	const { open, setOpen } = useMobileNav();

	const items = useMemo<ResolvedItem[]>(
		() => ITEMS.map((item) => ({ ...item, url: agencyUrl(item.href) })),
		[agencyUrl],
	);

	return (
		<>
			<nav
				aria-label="Primary"
				className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r py-3 md:flex [view-transition-name:app-rail]"
			>
				{items.map((item) => (
					<RailLink
						key={item.url}
						item={item}
						active={isActive(item, pathname)}
					/>
				))}
			</nav>

			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent side="left" className="w-64 gap-0 p-0">
					<SheetHeader>
						<SheetTitle>Navigation</SheetTitle>
					</SheetHeader>
					<nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-2">
						{items.map((item) => (
							<MobileRailLink
								key={item.url}
								item={item}
								active={isActive(item, pathname)}
								onNavigate={() => setOpen(false)}
							/>
						))}
					</nav>
				</SheetContent>
			</Sheet>
		</>
	);
}
