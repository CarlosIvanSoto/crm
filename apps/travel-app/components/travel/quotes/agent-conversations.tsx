"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { useQuery } from "@tanstack/react-query";
import { LocalDateTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

export type Conversation = RouterOutputs["agentConversation"]["list"][number];

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
};

function label(conversation: Conversation): string {
	return conversation.userId ? "Advisor chat" : "Follow-up sweep";
}

export function ConversationPicker({
	conversations,
	current,
	onSelect,
	onNew,
	busy,
}: {
	conversations: Conversation[];
	current: Conversation | null;
	onSelect: (conversation: Conversation) => void;
	onNew: () => void;
	busy: boolean;
}) {
	return (
		<div className="flex min-w-0 items-center gap-2 border-b px-4 py-2 sm:px-5">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						disabled={busy}
						className="min-w-0 flex-1 justify-start px-2 font-normal"
					>
						<span className="truncate">
							{current ? label(current) : "New conversation"}
						</span>
						<Icon icon={ChevronDown} data-icon="inline-end" />
					</Button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="start" className="w-72">
					{conversations.length === 0 ? (
						<DropdownMenuItem disabled>Nothing yet</DropdownMenuItem>
					) : (
						conversations.map((conversation) => (
							<DropdownMenuItem
								key={conversation.id}
								onSelect={() => onSelect(conversation)}
							>
								<span className="min-w-0 flex-1 truncate">
									{label(conversation)}
								</span>
								{conversation.lastMessageAt ? (
									<span className="shrink-0 text-muted-foreground text-xs">
										<LocalDateTime
											date={conversation.lastMessageAt}
											options={DATE_OPTIONS}
										/>
									</span>
								) : null}
							</DropdownMenuItem>
						))
					)}

					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={onNew}>New conversation</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export function useConversations(quoteId: string) {
	const trpc = useTRPC();
	return useQuery(trpc.agentConversation.list.queryOptions({ quoteId }));
}
