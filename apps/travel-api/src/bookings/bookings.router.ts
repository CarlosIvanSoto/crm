import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AgencyTrpcContext } from "../trpc/context.types";
import { AgencyMiddleware } from "../trpc/middlewares/agency.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	bookingArchiveResultOutput,
	bookingBulkInput,
	bookingBulkResultOutput,
	bookingCreateInput,
	bookingDetailOutput,
	bookingIdInput,
	bookingListInput,
	bookingListOutput,
	bookingSummaryOutput,
	bookingUpdateArgs,
	setBookingItemsInput,
	setBookingTravelersInput,
} from "./bookings.contracts";
import { BookingsService } from "./bookings.service";

@Router({ alias: "bookings" })
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
export class BookingsRouter {
	constructor(
		@Inject(BookingsService) private readonly bookings: BookingsService,
	) {}

	@Query({
		input: bookingListInput,
		output: bookingListOutput,
		meta: restMeta("POST", "/bookings/search", ["Bookings"]),
	})
	async list(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof bookingListInput>,
	) {
		return this.bookings.list(ctx.agencyId, ctx.role, input);
	}

	@Query({
		input: bookingIdInput,
		output: bookingDetailOutput,
		meta: restMeta("GET", "/bookings/{id}", ["Bookings"]),
	})
	async byId(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.bookings.byId(ctx.agencyId, ctx.role, id);
	}

	@Mutation({
		input: bookingCreateInput,
		output: bookingSummaryOutput,
		meta: restMeta("POST", "/bookings", ["Bookings"]),
	})
	async create(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof bookingCreateInput>,
	) {
		return this.bookings.create(ctx.agencyId, input);
	}

	@Mutation({
		input: bookingUpdateArgs,
		output: bookingSummaryOutput,
		meta: restMeta("PATCH", "/bookings/{id}", ["Bookings"]),
	})
	async update(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof bookingUpdateArgs>,
	) {
		return this.bookings.update(ctx.agencyId, input.id, input.data);
	}

	@Mutation({
		input: setBookingItemsInput,
		output: bookingDetailOutput,
		meta: restMeta("PUT", "/bookings/{id}/items", ["Bookings"]),
	})
	async setItems(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setBookingItemsInput>,
	) {
		return this.bookings.setItems(
			ctx.agencyId,
			ctx.role,
			input.id,
			input.items,
		);
	}

	@Mutation({
		input: setBookingTravelersInput,
		output: bookingDetailOutput,
		meta: restMeta("PUT", "/bookings/{id}/travelers", ["Bookings"]),
	})
	async setTravelers(
		@Ctx() ctx: AgencyTrpcContext,
		@Input() input: z.infer<typeof setBookingTravelersInput>,
	) {
		return this.bookings.setTravelers(
			ctx.agencyId,
			ctx.role,
			input.id,
			input.travelers,
		);
	}

	@Mutation({
		input: bookingIdInput,
		output: bookingArchiveResultOutput,
		meta: restMeta("POST", "/bookings/{id}/archive", ["Bookings"]),
	})
	async archive(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.bookings.archive(ctx.agencyId, id);
	}

	@Mutation({
		input: bookingIdInput,
		output: bookingArchiveResultOutput,
		meta: restMeta("POST", "/bookings/{id}/restore", ["Bookings"]),
	})
	async restore(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.bookings.restore(ctx.agencyId, id);
	}

	@Mutation({
		input: bookingIdInput,
		output: bookingArchiveResultOutput,
		meta: restMeta("DELETE", "/bookings/{id}", ["Bookings"]),
	})
	async purge(@Ctx() ctx: AgencyTrpcContext, @Input("id") id: string) {
		return this.bookings.purge(ctx.agencyId, id);
	}

	@Mutation({
		input: bookingBulkInput,
		output: bookingBulkResultOutput,
		meta: restMeta("POST", "/bookings/bulk-archive", ["Bookings"]),
	})
	async bulkArchive(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.bookings.bulkArchive(ctx.agencyId, ids);
	}

	@Mutation({
		input: bookingBulkInput,
		output: bookingBulkResultOutput,
		meta: restMeta("POST", "/bookings/bulk-restore", ["Bookings"]),
	})
	async bulkRestore(
		@Ctx() ctx: AgencyTrpcContext,
		@Input("ids") ids: string[],
	) {
		return this.bookings.bulkRestore(ctx.agencyId, ids);
	}

	@Mutation({
		input: bookingBulkInput,
		output: bookingBulkResultOutput,
		meta: restMeta("POST", "/bookings/bulk-purge", ["Bookings"]),
	})
	async bulkPurge(@Ctx() ctx: AgencyTrpcContext, @Input("ids") ids: string[]) {
		return this.bookings.bulkPurge(ctx.agencyId, ids);
	}
}
