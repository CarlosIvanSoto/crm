import { plainToInstance, Type } from "class-transformer";
import {
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	Min,
	MinLength,
	validateSync,
} from "class-validator";

export enum NodeEnv {
	Development = "development",
	Production = "production",
	Test = "test",
}

export class EnvironmentVariables {
	@IsEnum(NodeEnv)
	NODE_ENV: NodeEnv = NodeEnv.Development;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(65535)
	TRAVEL_PORT = 3011;

	@IsString()
	@MinLength(1, {
		message:
			"TRAVEL_DATABASE_URL is required. `docker compose up -d` starts the travel Postgres on 5433, or set it to any Postgres connection string.",
	})
	TRAVEL_DATABASE_URL!: string;

	@IsString()
	@MinLength(32, {
		message:
			"TRAVEL_BETTER_AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32",
	})
	TRAVEL_BETTER_AUTH_SECRET!: string;

	@IsOptional()
	@IsString()
	TRAVEL_GOOGLE_CLIENT_ID?: string;

	@IsOptional()
	@IsString()
	TRAVEL_GOOGLE_CLIENT_SECRET?: string;

	@IsOptional()
	@IsUrl({ require_tld: false })
	TRAVEL_API_URL?: string;

	@IsOptional()
	@IsString()
	TRAVEL_APP_URL?: string;

	@IsOptional()
	@IsString()
	TRAVEL_AUTH_COOKIE_DOMAIN?: string;

	@IsOptional()
	@IsString()
	@MinLength(16, {
		message: "TRAVEL_CRON_SECRET must be at least 16 characters.",
	})
	TRAVEL_CRON_SECRET?: string;

	@IsOptional()
	@IsString()
	TRAVEL_BLOB_READ_WRITE_TOKEN?: string;

	@IsOptional()
	@IsString()
	TRAVEL_RESEND_API_KEY?: string;

	@IsOptional()
	@IsString()
	TRAVEL_INVITATION_FROM?: string;

	@IsOptional()
	@IsString()
	TRAVEL_REMINDER_FROM?: string;

	@IsOptional()
	@IsString()
	REDIS_URL?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	CACHE_TTL_MS?: number;
}

export type RawEnvironment = Record<string, string | undefined>;

export function validateEnv(config: RawEnvironment): EnvironmentVariables {
	const validated = plainToInstance(EnvironmentVariables, config, {
		enableImplicitConversion: true,
		exposeDefaultValues: true,
	});

	const errors = validateSync(validated, {
		skipMissingProperties: false,
		whitelist: false,
	});

	if (errors.length > 0) {
		const details = errors
			.map((error) => Object.values(error.constraints ?? {}).join(", "))
			.join("\n  - ");

		throw new Error(
			`Invalid environment configuration:\n  - ${details}\n\nSee .env.example at the root of the repo.`,
		);
	}

	return validated;
}
