import { FIELD_ENTITIES, FIELD_TYPES } from "@travel/db/fields";
import { z } from "zod";

export const fieldEntity = z.enum(FIELD_ENTITIES);

export const fieldListInput = z.object({
	entity: fieldEntity,
	includeArchived: z.boolean().default(false),
});

export type FieldListInput = z.infer<typeof fieldListInput>;

export const fieldByKeyInput = z.object({
	entity: fieldEntity,
	key: z.string().trim().min(1),
});

export const fieldEntityInput = z.object({
	entity: fieldEntity,
});

const fieldOptionInput = z.object({
	id: z.string().optional(),
	label: z.string().trim().min(1, "An option needs a label."),
});

export const fieldCreateInput = z.object({
	entity: fieldEntity,
	label: z.string().trim().min(1, "A field needs a label."),
	type: z.enum(FIELD_TYPES),
	options: z.array(fieldOptionInput).default([]),
	required: z.boolean().default(false),
	showOnSheet: z.boolean().default(true),
	showOnTable: z.boolean().default(false),
	showOnFilter: z.boolean().default(false),
});

export type FieldCreateInput = z.infer<typeof fieldCreateInput>;

const fieldUpdateData = z.object({
	label: z.string().trim().min(1).optional(),
	type: z.enum(FIELD_TYPES).optional(),
	options: z.array(fieldOptionInput).optional(),
	required: z.boolean().optional(),
	showOnSheet: z.boolean().optional(),
	showOnTable: z.boolean().optional(),
	showOnFilter: z.boolean().optional(),
});

export type FieldUpdateData = z.infer<typeof fieldUpdateData>;

export const fieldUpdateArgs = z.object({
	id: z.string(),
	data: fieldUpdateData,
});

export const fieldIdInput = z.object({ id: z.string() });

export const fieldReorderInput = z.object({
	entity: fieldEntity,
	ids: z.array(z.string()).min(1),
});

export type FieldReorderInput = z.infer<typeof fieldReorderInput>;

const recordFieldValue = z.union(
	[z.string(), z.number(), z.boolean(), z.null()],
	{ error: "A field holds text, a number, true or false, or nothing at all." },
);

export const recordFieldValues = z.record(z.string(), recordFieldValue);

export const fieldValuesInput = z.object({
	entity: fieldEntity,
	recordId: z.string(),
});

export const setFieldValuesInput = z.object({
	entity: fieldEntity,
	recordId: z.string(),
	values: recordFieldValues,
});

export type SetFieldValuesInput = z.infer<typeof setFieldValuesInput>;

const fieldOptionOutput = z.object({
	id: z.string(),
	label: z.string(),
	position: z.number(),
});

export const serializedFieldOutput = z.object({
	id: z.string(),
	entity: fieldEntity,
	key: z.string(),
	label: z.string(),
	type: z.enum(FIELD_TYPES),
	typeLabel: z.string(),
	required: z.boolean(),
	showOnSheet: z.boolean(),
	showOnTable: z.boolean(),
	showOnFilter: z.boolean(),
	position: z.number(),
	archived: z.boolean(),
	options: z.array(fieldOptionOutput),
});

export const recordFieldOutput = serializedFieldOutput.extend({
	value: recordFieldValue,
});

export const fieldListOutput = z.array(serializedFieldOutput);

export const fieldFiltersOutput = z.array(serializedFieldOutput);

export const fieldReorderOutput = z.array(serializedFieldOutput);

export const recordFieldListOutput = z.array(recordFieldOutput);

export const fieldCoverageOutput = z.object({
	filled: z.number(),
	total: z.number(),
});

export const fieldDeleteOutput = z.object({ id: z.string() });
