import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { type AgencyRole, canRecordPayment } from "@travel/auth";
import { agencyDb, type Db, Prisma } from "@travel/db";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import type {
	AddPayableInput,
	AddPaymentInput,
	PaymentListInput,
	PaymentRow,
	RecordPaymentInput,
} from "./payments.contracts";

type DerivedStatus = "SCHEDULED" | "OVERDUE" | "PAID" | "VOID";

type RawRow = {
	id: string;
	bookingId: string;
	supplierId?: string;
	bookingItemId?: string | null;
	dueDate: Date;
	amount: Prisma.Decimal;
	currency: string;
	baseAmount: Prisma.Decimal | null;
	baseCurrency: string | null;
	status: "SCHEDULED" | "PAID" | "VOID";
	method: PaymentRow["method"];
	paidAt: Date | null;
	reference: string | null;
	createdAt: Date;
};

function deriveStatus(
	status: RawRow["status"],
	dueDate: Date,
	now: Date,
): DerivedStatus {
	if (status === "SCHEDULED" && dueDate.getTime() < now.getTime()) {
		return "OVERDUE";
	}
	return status;
}

@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async list(agencyId: string, input: PaymentListInput) {
		const scoped = agencyDb(this.db, agencyId);
		const now = new Date();
		const bookingFilter = input.bookingId ? { bookingId: input.bookingId } : {};

		const [customer, supplier, baseCurrency] = await Promise.all([
			input.kind === "supplier"
				? []
				: scoped.payment.findMany({
						where: bookingFilter,
						orderBy: { dueDate: "asc" },
					}),
			input.kind === "customer"
				? []
				: scoped.supplierPayment.findMany({
						where: bookingFilter,
						orderBy: { dueDate: "asc" },
					}),
			this.conversion.baseCurrencyFor(agencyId),
		]);

		const rows: PaymentRow[] = [
			...customer.map((row) => this.serialize(row, "customer", now)),
			...supplier.map((row) => this.serialize(row, "supplier", now)),
		].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

		const filtered =
			input.status.length > 0
				? rows.filter((row) => input.status.includes(row.status))
				: rows;

		let scheduledBase = 0;
		let overdueBase = 0;
		let paidBase = 0;
		let missingRate = 0;

		for (const row of filtered) {
			if (row.baseAmount === null) {
				missingRate += 1;
				continue;
			}
			if (row.status === "SCHEDULED") scheduledBase += row.baseAmount;
			if (row.status === "OVERDUE") overdueBase += row.baseAmount;
			if (row.status === "PAID") paidBase += row.baseAmount;
		}

		return {
			rows: filtered,
			totals: {
				baseCurrency,
				scheduledBase,
				overdueBase,
				paidBase,
				missingRate,
			},
		};
	}

	async add(agencyId: string, role: AgencyRole, input: AddPaymentInput) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		await this.requireBooking(scoped, input.bookingId);

		const amount = new Prisma.Decimal(input.amount.toFixed(2));
		const fx = await this.conversion.itemFields(
			agencyId,
			amount,
			input.currency,
		);

		const row = await scoped.payment.create({
			data: {
				agencyId,
				bookingId: input.bookingId,
				dueDate: new Date(input.dueDate),
				amount,
				currency: input.currency,
				baseAmount: fx.baseAmount,
				baseCurrency: fx.baseCurrency,
				fxRate: fx.fxRate,
				fxRateAt: fx.fxRateAt,
				method: input.method,
				reference: input.reference,
			},
			select: { id: true, status: true, dueDate: true },
		});

		this.logger.log({
			message: "Payment scheduled",
			agencyId,
			paymentId: row.id,
		});

		return {
			id: row.id,
			status: deriveStatus(row.status, row.dueDate, new Date()),
		};
	}

	async addPayable(agencyId: string, role: AgencyRole, input: AddPayableInput) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		await this.requireBooking(scoped, input.bookingId);

		const supplier = await scoped.supplier.findFirst({
			where: { id: input.supplierId },
			select: { id: true },
		});
		if (!supplier) throw new NotFoundException("That supplier does not exist.");

		if (input.bookingItemId) {
			const item = await scoped.bookingItem.findFirst({
				where: { id: input.bookingItemId, bookingId: input.bookingId },
				select: { id: true },
			});
			if (!item) {
				throw new BadRequestException(
					"That booking line is not on this booking.",
				);
			}
		}

		const amount = new Prisma.Decimal(input.amount.toFixed(2));
		const fx = await this.conversion.itemFields(
			agencyId,
			amount,
			input.currency,
		);

		const row = await scoped.supplierPayment.create({
			data: {
				agencyId,
				bookingId: input.bookingId,
				supplierId: input.supplierId,
				bookingItemId: input.bookingItemId,
				dueDate: new Date(input.dueDate),
				amount,
				currency: input.currency,
				baseAmount: fx.baseAmount,
				baseCurrency: fx.baseCurrency,
				fxRate: fx.fxRate,
				fxRateAt: fx.fxRateAt,
				method: input.method,
				reference: input.reference,
			},
			select: { id: true, status: true, dueDate: true },
		});

		this.logger.log({
			message: "Supplier payable scheduled",
			agencyId,
			supplierPaymentId: row.id,
		});

		return {
			id: row.id,
			status: deriveStatus(row.status, row.dueDate, new Date()),
		};
	}

	async record(agencyId: string, role: AgencyRole, input: RecordPaymentInput) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		const current = await scoped.payment.findFirst({
			where: { id: input.id },
			select: { id: true, status: true },
		});
		if (!current) throw new NotFoundException("That payment does not exist.");
		if (current.status === "VOID") {
			throw new BadRequestException("A void payment cannot be recorded.");
		}

		const row = await scoped.payment.update({
			where: { id: input.id },
			data: {
				status: "PAID",
				paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
				method: input.method ?? undefined,
				reference: input.reference ?? undefined,
			},
			select: { id: true, status: true, dueDate: true },
		});

		return {
			id: row.id,
			status: deriveStatus(row.status, row.dueDate, new Date()),
		};
	}

	async recordPayable(
		agencyId: string,
		role: AgencyRole,
		input: RecordPaymentInput,
	) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		const current = await scoped.supplierPayment.findFirst({
			where: { id: input.id },
			select: { id: true, status: true },
		});
		if (!current) throw new NotFoundException("That payable does not exist.");
		if (current.status === "VOID") {
			throw new BadRequestException("A void payable cannot be recorded.");
		}

		const row = await scoped.supplierPayment.update({
			where: { id: input.id },
			data: {
				status: "PAID",
				paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
				method: input.method ?? undefined,
				reference: input.reference ?? undefined,
			},
			select: { id: true, status: true, dueDate: true },
		});

		return {
			id: row.id,
			status: deriveStatus(row.status, row.dueDate, new Date()),
		};
	}

	async voidPayment(agencyId: string, role: AgencyRole, id: string) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		try {
			const row = await scoped.payment.update({
				where: { id },
				data: { status: "VOID" },
				select: { id: true, status: true, dueDate: true },
			});
			return {
				id: row.id,
				status: deriveStatus(row.status, row.dueDate, new Date()),
			};
		} catch (cause) {
			this.translate(cause, "payment");
		}
	}

	async voidPayable(agencyId: string, role: AgencyRole, id: string) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		try {
			const row = await scoped.supplierPayment.update({
				where: { id },
				data: { status: "VOID" },
				select: { id: true, status: true, dueDate: true },
			});
			return {
				id: row.id,
				status: deriveStatus(row.status, row.dueDate, new Date()),
			};
		} catch (cause) {
			this.translate(cause, "payable");
		}
	}

	async remove(agencyId: string, role: AgencyRole, id: string) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		const current = await scoped.payment.findFirst({
			where: { id },
			select: { status: true },
		});
		if (!current) throw new NotFoundException("That payment does not exist.");
		if (current.status === "PAID") {
			throw new BadRequestException(
				"Void a recorded payment; do not delete it.",
			);
		}
		await scoped.payment.delete({ where: { id } });
		return { id };
	}

	async removePayable(agencyId: string, role: AgencyRole, id: string) {
		this.requireRecorder(role);
		const scoped = agencyDb(this.db, agencyId);
		const current = await scoped.supplierPayment.findFirst({
			where: { id },
			select: { status: true },
		});
		if (!current) throw new NotFoundException("That payable does not exist.");
		if (current.status === "PAID") {
			throw new BadRequestException(
				"Void a recorded payable; do not delete it.",
			);
		}
		await scoped.supplierPayment.delete({ where: { id } });
		return { id };
	}

	private serialize(
		row: RawRow,
		kind: "customer" | "supplier",
		now: Date,
	): PaymentRow {
		return {
			id: row.id,
			kind,
			bookingId: row.bookingId,
			supplierId: row.supplierId ?? null,
			bookingItemId: row.bookingItemId ?? null,
			dueDate: row.dueDate.toISOString(),
			amount: row.amount.toNumber(),
			currency: row.currency,
			baseAmount: row.baseAmount === null ? null : row.baseAmount.toNumber(),
			baseCurrency: row.baseCurrency,
			status: deriveStatus(row.status, row.dueDate, now),
			storedStatus: row.status,
			method: row.method,
			paidAt: row.paidAt?.toISOString() ?? null,
			reference: row.reference,
			createdAt: row.createdAt.toISOString(),
		};
	}

	private requireRecorder(role: AgencyRole): void {
		if (!canRecordPayment(role)) {
			throw new ForbiddenException(
				"Only an admin or an accountant can change payments.",
			);
		}
	}

	private async requireBooking(
		scoped: ReturnType<typeof agencyDb>,
		bookingId: string,
	): Promise<void> {
		const booking = await scoped.booking.findFirst({
			where: { id: bookingId },
			select: { id: true },
		});
		if (!booking) throw new NotFoundException("That booking does not exist.");
	}

	private translate(cause: unknown, subject: "payment" | "payable"): never {
		const code = (cause as { code?: string }).code;
		if (code === "P2025") {
			throw new NotFoundException(`That ${subject} does not exist.`);
		}
		throw cause;
	}
}
