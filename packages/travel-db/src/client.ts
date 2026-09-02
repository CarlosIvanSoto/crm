import "@crm/env/load";

import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "./generated/prisma/client";

const connectionString =
	process.env.NODE_ENV === "test" ? testDatabase() : liveDatabase();

function liveDatabase(): string {
	const url = process.env.TRAVEL_DATABASE_URL;

	if (!url) {
		throw new Error(
			"TRAVEL_DATABASE_URL is not set. Copy .env.example to .env at the root of the repo and fill it in, or set TRAVEL_DATABASE_URL in the environment.",
		);
	}

	return url;
}

function testDatabase(): string {
	const url = process.env.TRAVEL_TEST_DATABASE_URL;

	if (!url) {
		throw new Error(
			[
				"TRAVEL_TEST_DATABASE_URL is not set, and the suite will not fall back to TRAVEL_DATABASE_URL.",
				"",
				"These are real integration tests. They write and delete rows across two",
				"agencies to prove tenant isolation, so a run that is interrupted leaves the",
				"database dirty. The pre-push hook runs them.",
				"",
				"Make a throwaway one and point TRAVEL_TEST_DATABASE_URL at it:",
				"",
				"    bun run travel:test",
				"",
			].join("\n"),
		);
	}

	if (!databaseName(url).endsWith("_test")) {
		throw new Error(
			`TRAVEL_TEST_DATABASE_URL must name a database ending in _test, so it cannot be one somebody is using. It names "${databaseName(url)}".`,
		);
	}

	return url;
}

function databaseName(url: string): string {
	try {
		return new URL(url).pathname.replace(/^\//, "");
	} catch {
		return url;
	}
}

export interface PrismaLogRecord {
	level: Prisma.LogLevel;
	message: string;
	target: string;
	durationMs?: number;
}

export type PrismaLogSink = (record: PrismaLogRecord) => void;

const consoleSink: PrismaLogSink = ({ level, message, target, durationMs }) => {
	const suffix = durationMs === undefined ? "" : ` (+${durationMs}ms)`;
	const line = `[prisma:${level}] ${message}${suffix} [${target}]`;

	if (level === "error") {
		console.error(line);
	} else if (level === "warn") {
		console.warn(line);
	} else {
		console.log(line);
	}
};

let sink: PrismaLogSink = consoleSink;

export function setPrismaLogSink(next: PrismaLogSink | null): void {
	sink = next ?? consoleSink;
}

const logQueries = process.env.PRISMA_LOG_QUERIES === "true";

const logDefinitions: Prisma.LogDefinition[] = [
	{ level: "warn", emit: "event" },
	{ level: "error", emit: "event" },
	...(logQueries
		? ([
				{ level: "query", emit: "event" },
				{ level: "info", emit: "event" },
			] satisfies Prisma.LogDefinition[])
		: []),
];

const createPrismaClient = () => {
	const client = new PrismaClient({
		adapter: new PrismaPg({ connectionString }),
		log: logDefinitions,
	});

	client.$on("error", ({ message, target }) => {
		sink({ level: "error", message, target });
	});
	client.$on("warn", ({ message, target }) => {
		sink({ level: "warn", message, target });
	});
	client.$on("info", ({ message, target }) => {
		sink({ level: "info", message, target });
	});
	client.$on("query", ({ query, duration, target }) => {
		sink({ level: "query", message: query, target, durationMs: duration });
	});

	return client;
};

declare global {
	var travelPrisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const db = globalThis.travelPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.travelPrisma = db;
}

export type Db = typeof db;
