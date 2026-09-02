import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "@travel/auth";
import { AgencyModule } from "./agency/agency.module";
import { BookingsModule } from "./bookings/bookings.module";
import { AppCacheModule } from "./cache/cache.module";
import { validateEnv } from "./config/env.validation";
import { CurrencyModule } from "./currency/currency.module";
import { CustomersModule } from "./customers/customers.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";
import { logAuthRoute } from "./logging/request-logger.middleware";
import { QuotesModule } from "./quotes/quotes.module";
import { TrpcModule } from "./trpc/trpc.module";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		LoggingModule,
		ConfigModule.forRoot({
			isGlobal: true,
			cache: true,
			validate: validateEnv,
		}),
		AppCacheModule,
		DatabaseModule,
		BetterAuthModule.forRoot({ auth, middleware: logAuthRoute }),
		HealthModule,
		TrpcModule,
		CurrencyModule,
		AgencyModule,
		UsersModule,
		CustomersModule,
		QuotesModule,
		BookingsModule,
	],
})
export class AppModule {}
