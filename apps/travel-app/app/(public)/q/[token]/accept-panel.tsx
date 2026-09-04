"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { OptionCard } from "./option-card";

type PublicOptions = RouterOutputs["publicQuote"]["view"]["options"];

export function AcceptPanel({
	token,
	options,
	onAccepted,
}: {
	token: string;
	options: PublicOptions;
	onAccepted: () => void;
}) {
	const trpc = useTRPC();
	const nameId = useId();
	const [selectedId, setSelectedId] = useState<string | null>(
		options.find((option) => option.isRecommended)?.id ??
			options[0]?.id ??
			null,
	);
	const [name, setName] = useState("");

	const accept = useMutation(
		trpc.publicQuote.accept.mutationOptions({
			onSuccess: () => {
				toast.success("Thanks — your choice is confirmed.");
				onAccepted();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				{options.map((option) => (
					<OptionCard
						key={option.id}
						option={option}
						selected={option.id === selectedId}
						onSelect={setSelectedId}
					/>
				))}
			</div>

			<Card data-print="hide">
				<CardHeader>
					<CardTitle>Accept this quote</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Your name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Full name"
							/>
						</Field>
						<Button
							disabled={
								!selectedId || name.trim().length < 2 || accept.isPending
							}
							onClick={() =>
								selectedId &&
								accept.mutate({
									token,
									optionId: selectedId,
									name: name.trim(),
								})
							}
						>
							Accept quote
						</Button>
					</FieldGroup>
				</CardContent>
			</Card>
		</div>
	);
}
