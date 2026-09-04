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
import { RemindersService } from "./reminders.service";

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
export class RemindersController {
	private readonly logger = new Logger(RemindersController.name);
	private readonly secret: string | undefined;

	constructor(
		private readonly reminders: RemindersService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("TRAVEL_CRON_SECRET", { infer: true });
	}

	@Get("reminders")
	@AllowAnonymous()
	@ApiOperation({
		summary:
			"Mail overdue-task assignees and write payment and departure tasks",
	})
	@ApiOkResponse({ description: "Sweep counts." })
	async remindersViaGet(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	@Post("reminders")
	@AllowAnonymous()
	@ApiExcludeEndpoint()
	async remindersViaPost(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	private async run(authorization?: string) {
		if (!this.secret) {
			this.logger.error({
				message:
					"TRAVEL_CRON_SECRET is not set — refusing to run the reminders route.",
			});
			throw new ServiceUnavailableException("Reminders are not configured.");
		}

		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}

		return this.reminders.sweepAllAgencies();
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
