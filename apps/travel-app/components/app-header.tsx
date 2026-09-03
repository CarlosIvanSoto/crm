"use client";

import Asleep from "@carbon/icons-react/es/Asleep";
import Light from "@carbon/icons-react/es/Light";
import Logout from "@carbon/icons-react/es/Logout";
import Menu from "@carbon/icons-react/es/Menu";
import { Avatar, AvatarFallback } from "@crm/ui/components/avatar";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import Logo from "@crm/ui/components/logo";
import { Separator } from "@crm/ui/components/separator";
import { Skeleton } from "@crm/ui/components/skeleton";
import { initialsFromName } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useMobileNav } from "@/components/mobile-nav";
import { signOutAndRedirect } from "@/lib/sign-out";
import { useTRPC } from "@/lib/trpc/client";
import { useAgencyUrl } from "@/lib/use-agency-url";

type User = { name: string; email: string; image: string | null };

export function AppHeader({ user }: { user: User }) {
	const { setOpen: setMobileNavOpen } = useMobileNav();
	const trpc = useTRPC();
	const agencyUrl = useAgencyUrl();
	const agency = useQuery(trpc.agency.profile.queryOptions());

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 [view-transition-name:app-header]">
			<div className="flex shrink-0 items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					className="md:hidden"
					aria-label="Open navigation"
					onClick={() => setMobileNavOpen(true)}
				>
					<Menu />
				</Button>
				<Link
					href={agencyUrl()}
					aria-label="Homepage"
					className="hidden size-8 items-center justify-center text-foreground md:flex"
				>
					<Logo className="size-5" />
				</Link>
				<Separator orientation="vertical" className="mx-1 h-5 bg-transparent" />
				{agency.data ? (
					<span className="truncate font-medium text-sm">
						{agency.data.name}
					</span>
				) : (
					<Skeleton className="h-4 w-28" />
				)}
			</div>

			<div className="ml-auto flex items-center gap-1">
				<UserMenu user={user} />
			</div>
		</header>
	);
}

function UserMenu({ user }: { user: User }) {
	const { resolvedTheme, setTheme } = useTheme();
	const dark = resolvedTheme === "dark";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Account">
					<Avatar className="size-7">
						<AvatarFallback>{initialsFromName(user.name)}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-52">
				<DropdownMenuLabel className="truncate font-normal text-muted-foreground">
					{user.email}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => setTheme(dark ? "light" : "dark")}>
					{dark ? <Light /> : <Asleep />}
					{dark ? "Light mode" : "Dark mode"}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onSelect={() => {
						void signOutAndRedirect();
					}}
				>
					<Logout />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function AppHeaderFallback() {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
			<Skeleton className="h-4 w-28" />
		</header>
	);
}
