import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "@travel/auth";
import { ActivitiesModule } from "./activities/activities.module";
import { AgencyModule } from "./agency/agency.module";
import { BookingsModule } from "./bookings/bookings.module";
import { AppCacheModule } from "./cache/cache.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { validateEnv } from "./config/env.validation";
import { CurrencyModule } from "./currency/currency.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DatabaseModule } from "./database/database.module";
import { FieldsModule } from "./fields/fields.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";
import { logAuthRoute } from "./logging/request-logger.middleware";
import { PaymentsModule } from "./payments/payments.module";
import { QuotesModule } from "./quotes/quotes.module";
import { SavedViewsModule } from "./saved-views/saved-views.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { TravelModule } from "./travel/travel.module";
import { TravelersModule } from "./travelers/travelers.module";
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
		TravelModule,
		BetterAuthModule.forRoot({ auth, middleware: logAuthRoute }),
		HealthModule,
		TrpcModule,
		CurrencyModule,
		DashboardModule,
		AgencyModule,
		UsersModule,
		CustomersModule,
		TravelersModule,
		SuppliersModule,
		QuotesModule,
		BookingsModule,
		PaymentsModule,
		CommissionsModule,
		ActivitiesModule,
		FieldsModule,
		SavedViewsModule,
	],
})
export class AppModule {}
