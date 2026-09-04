import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router } from "nestjs-trpc";
import type { z } from "zod";
import { restMeta } from "../trpc/openapi";
import {
	publicAcceptInput,
	publicAcceptOutput,
	publicQuoteOutput,
	publicTokenInput,
} from "./quote-share.contracts";
import { QuoteShareService } from "./quote-share.service";

@Router({ alias: "publicQuote" })
export class PublicQuoteRouter {
	constructor(
		@Inject(QuoteShareService)
		private readonly quoteShare: QuoteShareService,
	) {}

	@Query({
		input: publicTokenInput,
		output: publicQuoteOutput,
		meta: restMeta("GET", "/public/quotes/{token}", ["Quotes"], {
			protect: false,
		}),
	})
	async view(@Input("token") token: string) {
		return this.quoteShare.view(token);
	}

	@Mutation({
		input: publicAcceptInput,
		output: publicAcceptOutput,
		meta: restMeta("POST", "/public/quotes/{token}/accept", ["Quotes"], {
			protect: false,
		}),
	})
	async accept(@Input() input: z.infer<typeof publicAcceptInput>) {
		return this.quoteShare.accept(input.token, input.optionId, input.name);
	}
}
