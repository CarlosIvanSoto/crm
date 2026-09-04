"use client";

import Add from "@carbon/icons-react/es/Add";
import Calendar from "@carbon/icons-react/es/Calendar";
import { Button } from "@crm/ui/components/button";
import { Calendar as DayPicker } from "@crm/ui/components/calendar";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useTravelCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type AnchorKind = "customer" | "quote" | "booking";

const NO_ANCHOR = "none";
const ASSIGN_ME = "me";

const dueFormat = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New task
		</Button>
	);
}

export function CreateTaskSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateTaskForm />
		</Suspense>
	);
}

function CreateTaskForm() {
	const trpc = useTRPC();
	const cache = useTravelCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);

	const [anchorKind, setAnchorKind] = useState<AnchorKind>("booking");
	const [anchorId, setAnchorId] = useState(NO_ANCHOR);
	const [subject, setSubject] = useState("");
	const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
	const [assignee, setAssignee] = useState(ASSIGN_ME);

	const subjectId = useId();

	const bookings = useQuery({
		...trpc.bookings.list.queryOptions({
			sort: "createdAt",
			dir: "desc",
			pageSize: 50,
		}),
		enabled: anchorKind === "booking",
	});
	const quotes = useQuery({
		...trpc.quotes.list.queryOptions({
			sort: "createdAt",
			dir: "desc",
			pageSize: 50,
		}),
		enabled: anchorKind === "quote",
	});
	const customers = useQuery({
		...trpc.customers.list.queryOptions({
			sort: "createdAt",
			dir: "desc",
			pageSize: 50,
		}),
		enabled: anchorKind === "customer",
	});
	const advisors = useQuery(trpc.users.list.queryOptions());

	const options =
		anchorKind === "booking"
			? (bookings.data?.rows ?? []).map((row) => ({
					id: row.id,
					label: `${row.folio} · ${row.customer.name}`,
				}))
			: anchorKind === "quote"
				? (quotes.data?.rows ?? []).map((row) => ({
						id: row.id,
						label: `${row.folio} · ${row.customer.name}`,
					}))
				: (customers.data?.rows ?? []).map((row) => ({
						id: row.id,
						label: row.name,
					}));

	const reset = () => {
		setAnchorKind("booking");
		setAnchorId(NO_ANCHOR);
		setSubject("");
		setDueAt(undefined);
		setAssignee(ASSIGN_ME);
	};

	const create = useMutation(
		trpc.activities.create.mutationOptions({
			onSuccess: async () => {
				await cache.activity();
				toast.success("Task created.");
				await setOpen(null);
				reset();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const valid = anchorId !== NO_ANCHOR && subject.trim().length > 0;

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>New task</SheetTitle>
					<SheetDescription>
						A task hangs off a customer, a quote or a booking, and it shows in
						that record's timeline.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-task"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!valid) return;
						create.mutate({
							type: "TASK",
							subject: subject.trim(),
							customerId: anchorKind === "customer" ? anchorId : undefined,
							quoteId: anchorKind === "quote" ? anchorId : undefined,
							bookingId: anchorKind === "booking" ? anchorId : undefined,
							dueAt: dueAt?.toISOString() ?? null,
							assignedToId: assignee === ASSIGN_ME ? null : assignee,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-task-kind">About</FieldLabel>
							<Select
								value={anchorKind}
								onValueChange={(next) => {
									setAnchorKind(next as AnchorKind);
									setAnchorId(NO_ANCHOR);
								}}
							>
								<SelectTrigger id="create-task-kind">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="booking">Booking</SelectItem>
									<SelectItem value="quote">Quote</SelectItem>
									<SelectItem value="customer">Customer</SelectItem>
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-task-anchor">Record</FieldLabel>
							<Select value={anchorId} onValueChange={setAnchorId}>
								<SelectTrigger id="create-task-anchor">
									<SelectValue placeholder="Pick a record" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_ANCHOR}>Pick a record</SelectItem>
									{options.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor={subjectId}>What needs doing</FieldLabel>
							<Input
								id={subjectId}
								value={subject}
								onChange={(event) => setSubject(event.target.value)}
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-task-due">Due date</FieldLabel>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										id="create-task-due"
										variant="outline"
										className="justify-start"
									>
										<Icon icon={Calendar} data-icon="inline-start" />
										{dueAt ? dueFormat.format(dueAt) : "No due date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent size="fit" align="start">
									<DayPicker
										mode="single"
										selected={dueAt}
										onSelect={setDueAt}
										autoFocus
									/>
								</PopoverContent>
							</Popover>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-task-advisor">Advisor</FieldLabel>
							<Select value={assignee} onValueChange={setAssignee}>
								<SelectTrigger id="create-task-advisor">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ASSIGN_ME}>Assign to me</SelectItem>
									{(advisors.data ?? []).map((advisor) => (
										<SelectItem key={advisor.id} value={advisor.id}>
											{advisor.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-task"
						disabled={create.isPending || !valid}
					>
						{create.isPending ? <Spinner /> : null}
						Create task
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
