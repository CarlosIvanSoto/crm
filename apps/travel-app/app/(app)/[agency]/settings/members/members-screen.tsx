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
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
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
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterInputs } from "@/lib/trpc/types";

type AgencyRole = RouterInputs["agency"]["setRole"]["role"];

const ROLE_LABEL = {
	owner: "Owner",
	admin: "Admin",
	agent: "Agent",
	accountant: "Accountant",
} satisfies Record<AgencyRole, string>;

const ROLES = Object.keys(ROLE_LABEL) as AgencyRole[];

const CELL = "px-3 py-2.5 align-middle";

const MEMBER_COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Name" },
	{ id: "role", header: "Role", width: "w-40" },
	{ id: "joined", header: "Joined", width: "w-28", align: "right" },
	{ id: "actions", srLabel: "Actions", width: "w-20" },
];

const INVITE_COLUMNS: SimpleTableColumn[] = [
	{ id: "email", header: "Email" },
	{ id: "role", header: "Role", width: "w-32" },
	{ id: "expires", header: "Expires", width: "w-28", align: "right" },
	{ id: "actions", srLabel: "Actions", width: "w-20" },
];

export function MembersScreen() {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const emailId = useId();
	const roleId = useId();

	const [email, setEmail] = useState("");
	const [role, setRole] = useState<AgencyRole>("agent");
	const [lastLink, setLastLink] = useState<string | null>(null);

	const profile = useQuery(trpc.agency.profile.queryOptions());
	const members = useQuery(trpc.agency.members.queryOptions());
	const invitations = useQuery(trpc.agency.invitations.queryOptions());

	const settle = () => cache.agency();

	const invite = useMutation(
		trpc.agency.invite.mutationOptions({
			onSuccess: async (result) => {
				await settle();
				setEmail("");
				setRole("agent");
				if (result.delivered) {
					setLastLink(null);
					toast.success(`Invitation sent to ${result.email}.`);
				} else {
					setLastLink(result.url);
					toast.success("Invitation ready. Copy the link below.");
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setMemberRole = useMutation(
		trpc.agency.setRole.mutationOptions({
			onSuccess: async () => {
				await settle();
				toast.success("Role changed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const removeMember = useMutation(
		trpc.agency.removeMember.mutationOptions({
			onSuccess: async () => {
				await settle();
				toast.success("Member removed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const revoke = useMutation(
		trpc.agency.revokeInvitation.mutationOptions({
			onSuccess: async () => {
				await settle();
				toast.success("Invitation revoked.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!profile.data) return null;

	const canManage = profile.data.canManage;
	const busy =
		invite.isPending ||
		setMemberRole.isPending ||
		removeMember.isPending ||
		revoke.isPending;

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Invite a member</CardTitle>
					<CardDescription>
						{canManage
							? "They join as the role you pick. Without an email service, you copy the link by hand."
							: "Only an owner or an admin can invite members."}
					</CardDescription>
				</CardHeader>

				<CardContent>
					<form
						className="flex flex-wrap items-end gap-3"
						onSubmit={(event) => {
							event.preventDefault();
							invite.mutate({ email: email.trim(), role });
						}}
					>
						<Field className="min-w-56 flex-1">
							<FieldLabel htmlFor={emailId}>Email</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								placeholder="advisor@example.com"
								disabled={!canManage || busy}
							/>
						</Field>

						<Field className="w-44">
							<FieldLabel htmlFor={roleId}>Role</FieldLabel>
							<Select
								value={role}
								disabled={!canManage || busy}
								onValueChange={(value) => setRole(value as AgencyRole)}
							>
								<SelectTrigger id={roleId} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ROLES.map((value) => (
										<SelectItem key={value} value={value}>
											{ROLE_LABEL[value]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Button
							type="submit"
							disabled={!canManage || busy || email.trim() === ""}
						>
							{invite.isPending ? <Spinner data-icon="inline-start" /> : null}
							Invite
						</Button>
					</form>

					{lastLink ? (
						<div className="mt-3 flex flex-wrap items-end gap-2">
							<Field className="min-w-56 flex-1">
								<FieldLabel>Invitation link</FieldLabel>
								<Input readOnly value={lastLink} />
							</Field>
							<Button
								variant="outline"
								onClick={() => {
									void navigator.clipboard.writeText(lastLink);
									toast.success("Link copied.");
								}}
							>
								Copy
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Members</CardTitle>
					<CardDescription>
						{members.data?.length ?? 0} with access
					</CardDescription>
				</CardHeader>

				{members.data && members.data.length > 0 ? (
					<SimpleTable columns={MEMBER_COLUMNS}>
						{members.data.map((member) => (
							<SimpleTableRow key={member.id}>
								<TableCell className={CELL}>
									<span className="flex min-w-0 items-center gap-2">
										<PersonAvatar
											size="sm"
											src={member.image}
											name={member.name}
											email={member.email}
										/>
										<span className="flex min-w-0 flex-col">
											<span className="truncate font-medium">
												{member.name}
												{member.isViewer ? (
													<span className="ml-1 text-muted-foreground text-xs">
														You
													</span>
												) : null}
											</span>
											<span className="truncate text-muted-foreground">
												{member.email}
											</span>
										</span>
									</span>
								</TableCell>
								<TableCell className={CELL}>
									{canManage ? (
										<Select
											value={member.role}
											disabled={busy}
											onValueChange={(value) =>
												setMemberRole.mutate({
													memberId: member.id,
													role: value as AgencyRole,
												})
											}
										>
											<SelectTrigger className="w-36">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{ROLES.map((value) => (
													<SelectItem key={value} value={value}>
														{ROLE_LABEL[value]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<span className="text-muted-foreground">
											{ROLE_LABEL[member.role]}
										</span>
									)}
								</TableCell>
								<TableCell
									className={`${CELL} text-right text-muted-foreground`}
								>
									<LocalRelativeTime date={member.joinedAt} />
								</TableCell>
								<TableCell className={`${CELL} text-right`}>
									{canManage && !member.isViewer ? (
										<Button
											variant="ghost"
											size="sm"
											disabled={busy}
											onClick={() =>
												removeMember.mutate({ memberId: member.id })
											}
										>
											Remove
										</Button>
									) : null}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				) : (
					<CardTableEmpty>Nobody has access yet.</CardTableEmpty>
				)}
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Pending invitations</CardTitle>
					<CardDescription>
						Invitations that nobody has accepted yet
					</CardDescription>
				</CardHeader>

				{invitations.data && invitations.data.length > 0 ? (
					<SimpleTable columns={INVITE_COLUMNS}>
						{invitations.data.map((invitation) => (
							<SimpleTableRow key={invitation.id}>
								<TableCell className={CELL}>
									<span className="truncate">{invitation.email}</span>
								</TableCell>
								<TableCell className={`${CELL} text-muted-foreground`}>
									{ROLE_LABEL[invitation.role]}
								</TableCell>
								<TableCell
									className={`${CELL} text-right text-muted-foreground`}
								>
									<LocalRelativeTime date={invitation.expiresAt} />
								</TableCell>
								<TableCell className={`${CELL} text-right`}>
									{canManage ? (
										<Button
											variant="ghost"
											size="sm"
											disabled={busy}
											onClick={() =>
												revoke.mutate({ invitationId: invitation.id })
											}
										>
											Revoke
										</Button>
									) : null}
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				) : (
					<CardTableEmpty>No pending invitations.</CardTableEmpty>
				)}
			</Card>
		</div>
	);
}
