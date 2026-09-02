import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	agencyDb,
	type Db,
	type FieldEntity,
	type Prisma,
	Prisma as PrismaNamespace,
} from "@travel/db";
import {
	attachValues,
	type FieldDefinitionWithOptions,
	FieldValueError,
	fieldKeyFromLabel,
	type RecordField,
	recordColumn,
	type SerializedField,
	serializeField,
	usesOptions,
	writeValues,
} from "@travel/db/fields";
import { InjectDatabase } from "../database/database.constants";
import type {
	FieldCreateInput,
	FieldReorderInput,
	FieldUpdateData,
} from "./fields.contracts";

const WITH_OPTIONS = {
	options: { orderBy: { position: "asc" } },
} as const satisfies Prisma.FieldDefinitionInclude;

type Scoped = ReturnType<typeof agencyDb>;

@Injectable()
export class FieldsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(
		agencyId: string,
		entity: FieldEntity,
		includeArchived: boolean,
	): Promise<SerializedField[]> {
		const scoped = agencyDb(this.db, agencyId);
		const definitions = await scoped.fieldDefinition.findMany({
			where: { entity, archivedAt: includeArchived ? undefined : null },
			include: WITH_OPTIONS,
			orderBy: { position: "asc" },
		});

		return definitions.map(serializeField);
	}

	async byKey(
		agencyId: string,
		entity: FieldEntity,
		key: string,
	): Promise<SerializedField> {
		const definition = await this.requireByKey(
			agencyDb(this.db, agencyId),
			entity,
			key,
		);
		return serializeField(definition);
	}

	async filters(
		agencyId: string,
		entity: FieldEntity,
	): Promise<SerializedField[]> {
		const definitions = await this.filterableFieldsFor(agencyId, entity);
		return definitions.map(serializeField);
	}

	async coverage(
		agencyId: string,
		id: string,
	): Promise<{ filled: number; total: number }> {
		const scoped = agencyDb(this.db, agencyId);
		const definition = await scoped.fieldDefinition.findFirst({
			where: { id },
			select: { entity: true },
		});

		if (!definition) throw new NotFoundException("That field does not exist.");

		const column = recordColumn(definition.entity);

		const [filled, total] = await Promise.all([
			scoped.fieldValue.count({
				where: { fieldId: id, [column]: { not: null } },
			}),
			this.countRecords(scoped, definition.entity),
		]);

		return { filled, total };
	}

	async create(
		agencyId: string,
		input: FieldCreateInput,
	): Promise<SerializedField> {
		const scoped = agencyDb(this.db, agencyId);
		const key = fieldKeyFromLabel(input.label);

		if (!key) {
			throw new BadRequestException("That label does not make a usable key.");
		}

		const taken = await scoped.fieldDefinition.findFirst({
			where: { entity: input.entity, key },
			select: { id: true },
		});

		if (taken) {
			throw new ConflictException(`There is already a field called "${key}".`);
		}

		if (usesOptions(input.type) && input.options.length === 0) {
			throw new BadRequestException("A select needs at least one option.");
		}

		const last = await scoped.fieldDefinition.findFirst({
			where: { entity: input.entity },
			orderBy: { position: "desc" },
			select: { position: true },
		});

		const definition = await scoped.fieldDefinition.create({
			data: {
				agencyId,
				entity: input.entity,
				key,
				label: input.label,
				type: input.type,
				required: input.required,
				showOnSheet: input.showOnSheet,
				showOnTable: input.showOnTable,
				showOnFilter: input.showOnFilter,
				position: (last?.position ?? -1) + 1,
				options: usesOptions(input.type)
					? {
							create: input.options.map((option, index) => ({
								agencyId,
								label: option.label,
								position: index,
							})),
						}
					: undefined,
			},
			include: WITH_OPTIONS,
		});

		return serializeField(definition);
	}

	async update(
		agencyId: string,
		id: string,
		data: FieldUpdateData,
	): Promise<SerializedField> {
		const scoped = agencyDb(this.db, agencyId);
		const existing = await scoped.fieldDefinition.findFirst({
			where: { id },
			include: WITH_OPTIONS,
		});

		if (!existing) throw new NotFoundException("That field does not exist.");

		const type = data.type ?? existing.type;

		if (data.type && data.type !== existing.type) {
			const values = await scoped.fieldValue.count({ where: { fieldId: id } });

			if (values > 0) {
				throw new ConflictException(
					"This field already holds values, so its type cannot change. Archive it and make a new one.",
				);
			}
		}

		const optionCount = data.options
			? data.options.length
			: existing.options.filter((option) => option.archivedAt === null).length;

		if (usesOptions(type) && optionCount === 0) {
			throw new BadRequestException("A select needs at least one option.");
		}

		const definition = await scoped.$transaction(async (tx) => {
			if (data.options && usesOptions(type)) {
				const keep = new Set(
					data.options
						.map((option) => option.id)
						.filter((value): value is string => Boolean(value)),
				);

				await tx.fieldOption.updateMany({
					where: { fieldId: id, id: { notIn: [...keep] }, archivedAt: null },
					data: { archivedAt: new Date() },
				});

				for (const [index, option] of data.options.entries()) {
					if (option.id) {
						await tx.fieldOption.update({
							where: { id: option.id },
							data: { label: option.label, position: index },
						});
						continue;
					}

					await tx.fieldOption.create({
						data: {
							agencyId,
							fieldId: id,
							label: option.label,
							position: index,
						},
					});
				}
			}

			return tx.fieldDefinition.update({
				where: { id },
				data: {
					label: data.label,
					type: data.type,
					required: data.required,
					showOnSheet: data.showOnSheet,
					showOnTable: data.showOnTable,
					showOnFilter: data.showOnFilter,
				},
				include: WITH_OPTIONS,
			});
		});

		return serializeField(definition);
	}

	async reorder(
		agencyId: string,
		input: FieldReorderInput,
	): Promise<SerializedField[]> {
		const scoped = agencyDb(this.db, agencyId);
		const owned = await scoped.fieldDefinition.findMany({
			where: { id: { in: input.ids }, entity: input.entity },
			select: { id: true },
		});

		if (owned.length !== input.ids.length) {
			throw new BadRequestException(
				"That order names a field which is not on this record type.",
			);
		}

		await scoped.$transaction(
			input.ids.map((id, index) =>
				scoped.fieldDefinition.update({
					where: { id },
					data: { position: index },
				}),
			),
		);

		return this.list(agencyId, input.entity, false);
	}

	async archive(agencyId: string, id: string): Promise<SerializedField> {
		return this.setArchived(agencyId, id, new Date());
	}

	async restore(agencyId: string, id: string): Promise<SerializedField> {
		return this.setArchived(agencyId, id, null);
	}

	async delete(agencyId: string, id: string): Promise<{ id: string }> {
		const scoped = agencyDb(this.db, agencyId);
		try {
			await scoped.fieldDefinition.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error);
		}

		return { id };
	}

	async valuesFor(
		agencyId: string,
		entity: FieldEntity,
		recordId: string,
	): Promise<RecordField[]> {
		const scoped = agencyDb(this.db, agencyId);
		await this.requireRecord(scoped, entity, recordId);

		const column = recordColumn(entity);
		const [definitions, rows] = await Promise.all([
			scoped.fieldDefinition.findMany({
				where: { entity, archivedAt: null },
				include: WITH_OPTIONS,
				orderBy: { position: "asc" },
			}),
			scoped.fieldValue.findMany({ where: { [column]: recordId } }),
		]);

		return attachValues(definitions, rows);
	}

	async setValues(
		agencyId: string,
		entity: FieldEntity,
		recordId: string,
		values: Record<string, string | number | boolean | null>,
	): Promise<RecordField[]> {
		const scoped = agencyDb(this.db, agencyId);
		await this.requireRecord(scoped, entity, recordId);

		if (Object.keys(values).length > 0) {
			await scoped.$transaction(async (tx) => {
				const definitions = await tx.fieldDefinition.findMany({
					where: { entity, archivedAt: null },
					include: WITH_OPTIONS,
					orderBy: { position: "asc" },
				});
				try {
					await writeValues(tx, entity, recordId, definitions, values);
				} catch (error) {
					if (error instanceof FieldValueError) {
						throw new BadRequestException(error.message);
					}
					throw error;
				}
			});
		}

		return this.valuesFor(agencyId, entity, recordId);
	}

	async filterableFieldsFor(
		agencyId: string,
		entity: FieldEntity,
	): Promise<FieldDefinitionWithOptions[]> {
		const scoped = agencyDb(this.db, agencyId);
		return scoped.fieldDefinition.findMany({
			where: {
				entity,
				archivedAt: null,
				showOnFilter: true,
				type: { in: ["SELECT", "USER"] },
			},
			include: WITH_OPTIONS,
			orderBy: { position: "asc" },
		});
	}

	private async setArchived(
		agencyId: string,
		id: string,
		archivedAt: Date | null,
	): Promise<SerializedField> {
		const scoped = agencyDb(this.db, agencyId);
		try {
			const definition = await scoped.fieldDefinition.update({
				where: { id },
				data: { archivedAt },
				include: WITH_OPTIONS,
			});
			return serializeField(definition);
		} catch (error) {
			throw this.translate(error);
		}
	}

	private async requireByKey(
		scoped: Scoped,
		entity: FieldEntity,
		key: string,
	): Promise<FieldDefinitionWithOptions> {
		const definition = await scoped.fieldDefinition.findFirst({
			where: { entity, key },
			include: WITH_OPTIONS,
		});

		if (!definition) throw new NotFoundException("That field does not exist.");

		return definition;
	}

	private async requireRecord(
		scoped: Scoped,
		entity: FieldEntity,
		recordId: string,
	): Promise<void> {
		const found = await this.findRecord(scoped, entity, recordId);
		if (!found) {
			throw new NotFoundException("That record does not exist.");
		}
	}

	private async findRecord(
		scoped: Scoped,
		entity: FieldEntity,
		recordId: string,
	): Promise<{ id: string } | null> {
		const where = { id: recordId };
		const select = { id: true };

		switch (entity) {
			case "CUSTOMER":
				return scoped.customer.findFirst({ where, select });
			case "TRAVELER":
				return scoped.traveler.findFirst({ where, select });
			case "QUOTE":
				return scoped.quote.findFirst({ where, select });
			case "BOOKING":
				return scoped.booking.findFirst({ where, select });
			case "SUPPLIER":
				return scoped.supplier.findFirst({ where, select });
			default:
				throw new BadRequestException("Unknown record type.");
		}
	}

	private async countRecords(
		scoped: Scoped,
		entity: FieldEntity,
	): Promise<number> {
		switch (entity) {
			case "CUSTOMER":
				return scoped.customer.count();
			case "TRAVELER":
				return scoped.traveler.count();
			case "QUOTE":
				return scoped.quote.count();
			case "BOOKING":
				return scoped.booking.count();
			case "SUPPLIER":
				return scoped.supplier.count();
			default:
				return 0;
		}
	}

	private translate(cause: unknown): never {
		if (
			cause instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			cause.code === "P2025"
		) {
			throw new NotFoundException("That field does not exist.");
		}

		throw cause;
	}
}
