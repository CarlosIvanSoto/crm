import type { Prisma } from "./generated/prisma/client";

export type JsonValue = Prisma.JsonValue;

export type JsonObject = Prisma.JsonObject;

export function jsonObject(value: JsonValue | undefined): JsonObject {
	return isJsonObject(value) ? value : {};
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
	return value instanceof Object && !Array.isArray(value);
}
