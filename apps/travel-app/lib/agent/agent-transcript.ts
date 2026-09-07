import {
	type EveStreamEvent,
	eveTurnFailure,
} from "@travel/validation/eve-stream";
import {
	type EveToolInput,
	type EveToolOutcome,
	type EveToolOutput,
	eveToolInput,
	eveToolOutcome,
	eveToolOutput,
} from "@travel/validation/eve-tool";
import type { MessageStreamEvent } from "eve/client";
import {
	defaultMessageReducer,
	type EveMessage,
	type EveMessageInputRequest,
	type EveMessagePart,
} from "eve/react";

export type TranscriptItem =
	| { kind: "said"; id: string; mine: boolean; text: string }
	| { kind: "reasoned"; id: string; streaming: boolean; text: string }
	| { kind: "asked"; id: string; question: EveMessageInputRequest }
	| {
			kind: "did";
			id: string;
			label: string;
			input: EveToolInput;
			output: EveToolOutput;
			tone: Tone;
			pending: boolean;
			tool: string;
			errorText: string | null;
	  };

export type Tone = "neutral" | "success" | "warning";

type ToolVerbs = Record<string, string>;

const VERBS: ToolVerbs = {
	read_quote: "Read the quote",
	read_quote_share: "Checked the share link's view history",
	read_customer: "Read the customer",
	write_followup_task: "Filed a follow-up task",
	load_skill: "Read its instructions for this",
	web_search: "Searched the web",
	web_fetch: "Read a web page",
	todo: "Updated its plan",
	ask_question: "Asked a question",
	bash: "Ran a command",
	read_file: "Read a file",
	write_file: "Wrote a file",
};

function humanise(tool: string): string {
	const words = tool.replace(/_/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function messagesFromEvents(
	events: readonly MessageStreamEvent[],
): readonly EveMessage[] {
	const reducer = defaultMessageReducer();
	let data = reducer.initial();

	for (const event of events) data = reducer.reduce(data, event);

	return data.messages;
}

export function toTranscript(
	messages: readonly EveMessage[],
): { id: string; mine: boolean; items: TranscriptItem[] }[] {
	const transcript: { id: string; mine: boolean; items: TranscriptItem[] }[] =
		[];

	for (const message of messages) {
		const row = {
			id: message.id,
			mine: message.role === "user",
			items: message.parts.flatMap((part, index): TranscriptItem[] => {
				const id = partId(message.id, part, index);

				if (part.type === "text") {
					const text = part.text.trim();
					if (!text) return [];
					return [{ kind: "said", id, mine: message.role === "user", text }];
				}

				if (part.type === "reasoning") {
					const text = part.text.trim();
					if (!text) return [];
					return [
						{
							kind: "reasoned",
							id,
							streaming: part.state === "streaming",
							text,
						},
					];
				}

				if (part.type === "dynamic-tool") {
					const request = part.toolMetadata?.eve?.inputRequest;
					if (request?.kind === "question") {
						return [{ kind: "asked", id, question: request }];
					}
				}

				if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
					const state = "state" in part ? part.state : undefined;
					const tool = toolName(part);

					return [
						{
							kind: "did",
							id,
							label: describe(part),
							input: input(part),
							output: output(part),
							errorText: errorTextOf(part),
							tone: outcomeTone(part),
							pending:
								state === "input-streaming" ||
								state === "input-available" ||
								state === "approval-requested",
							tool,
						},
					];
				}

				return [];
			}),
		};

		if (row.items.length > 0) transcript.push(row);
	}

	return transcript;
}

function partId(
	messageId: string,
	part: EveMessagePart,
	index: number,
): string {
	const callId = "toolCallId" in part ? part.toolCallId : null;
	return callId ? `${messageId}:${callId}` : `${messageId}:${index}`;
}

export function toolName(part: EveMessagePart): string {
	if (part.type === "dynamic-tool") return part.toolName;
	return part.type.replace(/^tool-/, "");
}

export function describe(part: EveMessagePart): string {
	const tool = toolName(part);
	const verb = VERBS[tool] ?? humanise(tool);
	const reason = outcome(part)?.reason ?? null;

	return reason === null ? verb : `${verb} — ${reason}`;
}

export function outcomeTone(part: EveMessagePart): Tone {
	if ("state" in part && part.state === "output-error") return "warning";

	const result = outcome(part);
	if (!result) return "neutral";

	if (result.applied === true || result.written === true) return "success";
	if (result.stored === false || result.written === false) return "warning";

	return "neutral";
}

export function pendingQuestion(messages: readonly EveMessage[]) {
	for (const part of messages.at(-1)?.parts ?? []) {
		if (part.type !== "dynamic-tool" || part.state !== "approval-requested") {
			continue;
		}

		const request = part.toolMetadata?.eve?.inputRequest;
		if (request?.kind === "question") return request;
	}

	return null;
}

export type AgentTurnFailure = { code: string; kind: "unknown" };

export function latestTurnFailure(
	events: readonly EveStreamEvent[],
): AgentTurnFailure | null {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (!event) continue;
		if (event.type === "turn.completed" || event.type === "turn.started") {
			return null;
		}
		if (event.type !== "turn.failed" && event.type !== "session.failed") {
			continue;
		}

		const failure = eveTurnFailure.parse(event.data);
		return { code: failure.code ?? "AGENT_FAILED", kind: "unknown" };
	}

	return null;
}

function payloadOf(part: EveMessagePart) {
	return "output" in part ? part.output : undefined;
}

function output(part: EveMessagePart): EveToolOutput {
	return eveToolOutput.parse(payloadOf(part));
}

function outcome(part: EveMessagePart): EveToolOutcome {
	return eveToolOutcome.parse(payloadOf(part));
}

function input(part: EveMessagePart): EveToolInput {
	return eveToolInput.parse("input" in part ? part.input : undefined);
}

function errorTextOf(part: EveMessagePart): string | null {
	const text = "errorText" in part ? part.errorText : undefined;
	return text?.trim() ? text : null;
}

export const NEW_THREAD = "new";

export type ResolvedThread<T> = {
	openId: string | null;
	current: T | null;
};

export function resolveThread<T extends { id: string }>({
	conversations,
	fromUrl,
	landedOn,
}: {
	conversations: readonly T[];
	fromUrl: string | null;
	landedOn: string | null;
}): ResolvedThread<T> {
	const openId = fromUrl ?? landedOn;

	if (!openId || openId === NEW_THREAD) return { openId, current: null };

	return {
		openId,
		current: conversations.find((row) => row.id === openId) ?? null,
	};
}
