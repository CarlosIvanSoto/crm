import {
	Controller,
	ForbiddenException,
	Get,
	Headers,
	Logger,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	ApiExcludeEndpoint,
	ApiForbiddenResponse,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiServiceUnavailableResponse,
	ApiTags,
} from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { QuoteFollowupService } from "./quote-followup.service";

@ApiTags("Internal — Cron")
@ApiHeader({
	name: "authorization",
	description: "`Bearer <TRAVEL_CRON_SECRET>`",
	required: true,
})
@ApiForbiddenResponse({ description: "TRAVEL_CRON_SECRET did not match." })
@ApiServiceUnavailableResponse({
	description: "TRAVEL_CRON_SECRET is not set.",
})
@Controller("internal/sync")
export class QuoteFollowupController {
	private readonly logger = new Logger(QuoteFollowupController.name);
	private readonly secret: string | undefined;

	constructor(
		private readonly quoteFollowups: QuoteFollowupService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("TRAVEL_CRON_SECRET", { infer: true });
	}

	@Get("quote-followups")
	@AllowAnonymous()
	@ApiOperation({
		summary: "Write a follow-up agent task for quotes sent and undecided",
	})
	@ApiOkResponse({ description: "Sweep counts." })
	async quoteFollowupsViaGet(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	@Post("quote-followups")
	@AllowAnonymous()
	@ApiExcludeEndpoint()
	async quoteFollowupsViaPost(
		@Headers("authorization") authorization?: string,
	) {
		return this.run(authorization);
	}

	private async run(authorization?: string) {
		if (!this.secret) {
			this.logger.error({
				message:
					"TRAVEL_CRON_SECRET is not set — refusing to run the quote-followups route.",
			});
			throw new ServiceUnavailableException(
				"Quote follow-ups are not configured.",
			);
		}

		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}

		return this.quoteFollowups.sweepAllAgencies();
	}
}

function timingSafeEquals(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}

	return mismatch === 0;
}
