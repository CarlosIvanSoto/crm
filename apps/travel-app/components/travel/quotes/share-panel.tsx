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
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function SharePanel({ quoteId }: { quoteId: string }) {
	const trpc = useTRPC();
	const cache = useTravelCache();
	const emailId = useId();
	const messageId = useId();

	const [lastUrl, setLastUrl] = useState<string | null>(null);
	const [to, setTo] = useState("");
	const [message, setMessage] = useState("");

	const status = useQuery(trpc.quoteShare.status.queryOptions({ quoteId }));

	const onError = (error: { message: string }) => toast.error(error.message);
	const settle = () => cache.quote(quoteId);

	const create = useMutation(
		trpc.quoteShare.create.mutationOptions({
			onSuccess: async (result) => {
				await settle();
				setLastUrl(result.url);
				toast.success("Link created. Copy it below.");
			},
			onError,
		}),
	);

	const revoke = useMutation(
		trpc.quoteShare.revoke.mutationOptions({
			onSuccess: async () => {
				await settle();
				setLastUrl(null);
				toast.success("Link revoked.");
			},
			onError,
		}),
	);

	const send = useMutation(
		trpc.quoteShare.send.mutationOptions({
			onSuccess: async (result) => {
				await settle();
				setLastUrl(null);
				setTo("");
				setMessage("");
				toast.success(
					result.delivered
						? `Sent to ${result.to}.`
						: "Could not send the email. Copy the link below.",
				);
				if (!result.delivered) setLastUrl(result.url);
			},
			onError,
		}),
	);

	const enabled = status.data?.enabled ?? false;

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Public link</CardTitle>
					<CardDescription>
						Anyone with this link can view the quote and accept an option. No
						sign-in needed.
					</CardDescription>
					<CardAction>
						{enabled ? (
							<Button
								variant="outline"
								disabled={revoke.isPending}
								onClick={() => revoke.mutate({ quoteId })}
							>
								Revoke link
							</Button>
						) : (
							<Button
								disabled={create.isPending}
								onClick={() => create.mutate({ quoteId, expiresInDays: null })}
							>
								Create link
							</Button>
						)}
					</CardAction>
				</CardHeader>
				<CardContent className="space-y-3">
					{status.isPending ? (
						<Spinner className="size-4" />
					) : enabled ? (
						<p className="text-muted-foreground text-sm">
							Viewed {status.data?.viewCount ?? 0} time
							{status.data?.viewCount === 1 ? "" : "s"}
							{status.data?.lastViewAt ? (
								<>
									{" · last "}
									<LocalRelativeTime date={status.data.lastViewAt} />
								</>
							) : null}
						</p>
					) : (
						<p className="text-muted-foreground text-sm">No active link.</p>
					)}

					{lastUrl ? (
						<div className="flex flex-wrap items-end gap-2">
							<Field className="min-w-56 flex-1">
								<FieldLabel>Link</FieldLabel>
								<Input readOnly value={lastUrl} />
							</Field>
							<Button
								variant="outline"
								onClick={() => {
									void navigator.clipboard.writeText(lastUrl);
									toast.success("Link copied.");
								}}
							>
								Copy
							</Button>
						</div>
					) : enabled ? (
						<p className="text-muted-foreground text-xs">
							The link exists. Revoke it and create a new one to see it again.
						</p>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Send to customer</CardTitle>
					<CardDescription>
						Emails the link through Resend. Without it configured, you get a
						copyable link instead.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={emailId}>Email</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={to}
								onChange={(event) => setTo(event.target.value)}
								placeholder="Uses the customer's email if left blank"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={messageId}>Message</FieldLabel>
							<Textarea
								id={messageId}
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								rows={3}
							/>
						</Field>
						<Button
							disabled={send.isPending}
							onClick={() =>
								send.mutate({
									quoteId,
									to: to.trim() || null,
									message: message.trim() || null,
								})
							}
						>
							Send
						</Button>
					</FieldGroup>
				</CardContent>
			</Card>
		</div>
	);
}
