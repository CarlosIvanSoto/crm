-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "TravelDocumentType" AS ENUM ('PASSPORT', 'ID', 'VISA');

-- CreateEnum
CREATE TYPE "SupplierKind" AS ENUM ('WHOLESALER', 'DMC', 'HOTEL', 'AIRLINE', 'CRUISE', 'INSURANCE', 'TRANSFER', 'TOUR_OPERATOR', 'CAR_RENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ItineraryItemType" AS ENUM ('FLIGHT', 'HOTEL', 'TRANSFER', 'TOUR', 'CRUISE', 'INSURANCE', 'CAR_RENTAL', 'PACKAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ItineraryItemStatus" AS ENUM ('QUOTED', 'REQUESTED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'TRAVELING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaxType" AS ENUM ('ADULT', 'CHILD', 'INFANT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SCHEDULED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "RateSource" AS ENUM ('FETCHED', 'MANUAL');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('VOUCHER', 'TICKET', 'INVOICE', 'PASSPORT', 'VISA', 'INSURANCE_POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FieldEntity" AS ENUM ('CUSTOMER', 'TRAVELER', 'QUOTE', 'BOOKING', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECT', 'URL', 'EMAIL', 'PHONE', 'USER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'agent',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apikey" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "start" TEXT,
    "referenceId" TEXT NOT NULL,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "refillInterval" INTEGER,
    "refillAmount" INTEGER,
    "lastRefillAt" TIMESTAMP(3),
    "enabled" BOOLEAN DEFAULT true,
    "rateLimitEnabled" BOOLEAN DEFAULT true,
    "rateLimitTimeWindow" INTEGER,
    "rateLimitMax" INTEGER,
    "requestCount" INTEGER DEFAULT 0,
    "remaining" INTEGER,
    "lastRequest" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,

    CONSTRAINT "apikey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencySettings" (
    "agencyId" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "taxRegime" TEXT,
    "addressJson" JSONB,
    "phone" TEXT,
    "email" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "logoUrl" TEXT,
    "quotePrefix" TEXT NOT NULL DEFAULT 'COT',
    "bookingPrefix" TEXT NOT NULL DEFAULT 'EXP',
    "defaultTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencySettings_pkey" PRIMARY KEY ("agencyId")
);

-- CreateTable
CREATE TABLE "agencyCounter" (
    "agencyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencyCounter_pkey" PRIMARY KEY ("agencyId","kind")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'PERSON',
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "taxRegime" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "addressJson" JSONB,
    "ownerId" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traveler" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "nationality" TEXT,
    "documentType" "TravelDocumentType",
    "documentNumber" TEXT,
    "documentIssuedCountry" TEXT,
    "documentExpiresAt" TIMESTAMP(3),
    "dietaryNotes" TEXT,
    "medicalNotes" TEXT,
    "emergencyContactJson" JSONB,
    "customerId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traveler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travelerLoyalty" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "supplierId" TEXT,
    "programName" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travelerLoyalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kind" "SupplierKind" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "defaultCommissionRate" DECIMAL(6,4),
    "paymentTermsDays" INTEGER,
    "defaultCurrency" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "travelStartDate" TIMESTAMP(3),
    "travelEndDate" TIMESTAMP(3),
    "paxAdults" INTEGER NOT NULL DEFAULT 1,
    "paxChildren" INTEGER NOT NULL DEFAULT 0,
    "paxInfants" INTEGER NOT NULL DEFAULT 0,
    "destination" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "terms" TEXT,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quoteOption" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "sellTotalBase" DECIMAL(24,4),
    "costTotalBase" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quoteOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quoteItem" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "quoteOptionId" TEXT NOT NULL,
    "type" "ItineraryItemType" NOT NULL,
    "supplierId" TEXT,
    "confirmationCode" TEXT,
    "status" "ItineraryItemStatus" NOT NULL DEFAULT 'QUOTED',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "startLocation" TEXT,
    "endLocation" TEXT,
    "description" TEXT,
    "paxCount" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "costAmount" DECIMAL(14,2),
    "costCurrency" TEXT,
    "sellAmount" DECIMAL(14,2),
    "sellCurrency" TEXT,
    "costBaseAmount" DECIMAL(24,4),
    "sellBaseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT,
    "quoteId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "travelStartDate" TIMESTAMP(3),
    "travelEndDate" TIMESTAMP(3),
    "destination" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sellTotalBase" DECIMAL(24,4),
    "costTotalBase" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookingTraveler" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "paxType" "PaxType" NOT NULL DEFAULT 'ADULT',
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookingTraveler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookingItem" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "ItineraryItemType" NOT NULL,
    "supplierId" TEXT,
    "confirmationCode" TEXT,
    "status" "ItineraryItemStatus" NOT NULL DEFAULT 'QUOTED',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "startLocation" TEXT,
    "endLocation" TEXT,
    "description" TEXT,
    "paxCount" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "costAmount" DECIMAL(14,2),
    "costCurrency" TEXT,
    "sellAmount" DECIMAL(14,2),
    "sellCurrency" TEXT,
    "costBaseAmount" DECIMAL(24,4),
    "sellBaseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "baseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "method" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplierPayment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingItemId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "baseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "method" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" "RateSource" NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "travelerId" TEXT,
    "kind" "DocumentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerId" TEXT,
    "quoteId" TEXT,
    "bookingId" TEXT,
    "createdById" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fieldDefinition" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "entity" "FieldEntity" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "showOnSheet" BOOLEAN NOT NULL DEFAULT true,
    "showOnTable" BOOLEAN NOT NULL DEFAULT false,
    "showOnFilter" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fieldOption" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "fieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fieldValue" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "customerId" TEXT,
    "quoteId" TEXT,
    "bookingId" TEXT,
    "travelerId" TEXT,
    "supplierId" TEXT,
    "text" TEXT,
    "number" DECIMAL(24,4),
    "date" TIMESTAMP(3),
    "bool" BOOLEAN,
    "optionId" TEXT,
    "userId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savedView" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "entity" "FieldEntity" NOT NULL,
    "name" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "apikey_referenceId_idx" ON "apikey"("referenceId");

-- CreateIndex
CREATE INDEX "apikey_configId_idx" ON "apikey"("configId");

-- CreateIndex
CREATE INDEX "apikey_key_idx" ON "apikey"("key");

-- CreateIndex
CREATE INDEX "customer_agencyId_idx" ON "customer"("agencyId");

-- CreateIndex
CREATE INDEX "customer_agencyId_lastActivityAt_idx" ON "customer"("agencyId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "customer_agencyId_archivedAt_idx" ON "customer"("agencyId", "archivedAt");

-- CreateIndex
CREATE INDEX "customer_ownerId_idx" ON "customer"("ownerId");

-- CreateIndex
CREATE INDEX "traveler_agencyId_idx" ON "traveler"("agencyId");

-- CreateIndex
CREATE INDEX "traveler_agencyId_lastName_firstName_idx" ON "traveler"("agencyId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "traveler_agencyId_documentExpiresAt_idx" ON "traveler"("agencyId", "documentExpiresAt");

-- CreateIndex
CREATE INDEX "traveler_customerId_idx" ON "traveler"("customerId");

-- CreateIndex
CREATE INDEX "travelerLoyalty_agencyId_idx" ON "travelerLoyalty"("agencyId");

-- CreateIndex
CREATE INDEX "travelerLoyalty_travelerId_idx" ON "travelerLoyalty"("travelerId");

-- CreateIndex
CREATE INDEX "travelerLoyalty_supplierId_idx" ON "travelerLoyalty"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_agencyId_idx" ON "supplier"("agencyId");

-- CreateIndex
CREATE INDEX "supplier_agencyId_kind_idx" ON "supplier"("agencyId", "kind");

-- CreateIndex
CREATE INDEX "supplier_agencyId_archivedAt_idx" ON "supplier"("agencyId", "archivedAt");

-- CreateIndex
CREATE INDEX "quote_agencyId_idx" ON "quote"("agencyId");

-- CreateIndex
CREATE INDEX "quote_agencyId_status_idx" ON "quote"("agencyId", "status");

-- CreateIndex
CREATE INDEX "quote_agencyId_createdAt_idx" ON "quote"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "quote_customerId_idx" ON "quote"("customerId");

-- CreateIndex
CREATE INDEX "quote_ownerId_idx" ON "quote"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_agencyId_folio_key" ON "quote"("agencyId", "folio");

-- CreateIndex
CREATE INDEX "quoteOption_agencyId_idx" ON "quoteOption"("agencyId");

-- CreateIndex
CREATE INDEX "quoteOption_quoteId_position_idx" ON "quoteOption"("quoteId", "position");

-- CreateIndex
CREATE INDEX "quoteItem_agencyId_idx" ON "quoteItem"("agencyId");

-- CreateIndex
CREATE INDEX "quoteItem_quoteOptionId_position_idx" ON "quoteItem"("quoteOptionId", "position");

-- CreateIndex
CREATE INDEX "quoteItem_supplierId_idx" ON "quoteItem"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_quoteId_key" ON "booking"("quoteId");

-- CreateIndex
CREATE INDEX "booking_agencyId_idx" ON "booking"("agencyId");

-- CreateIndex
CREATE INDEX "booking_agencyId_status_idx" ON "booking"("agencyId", "status");

-- CreateIndex
CREATE INDEX "booking_agencyId_lastActivityAt_idx" ON "booking"("agencyId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "booking_agencyId_travelStartDate_idx" ON "booking"("agencyId", "travelStartDate");

-- CreateIndex
CREATE INDEX "booking_agencyId_archivedAt_idx" ON "booking"("agencyId", "archivedAt");

-- CreateIndex
CREATE INDEX "booking_customerId_idx" ON "booking"("customerId");

-- CreateIndex
CREATE INDEX "booking_ownerId_idx" ON "booking"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_agencyId_folio_key" ON "booking"("agencyId", "folio");

-- CreateIndex
CREATE INDEX "bookingTraveler_agencyId_idx" ON "bookingTraveler"("agencyId");

-- CreateIndex
CREATE INDEX "bookingTraveler_travelerId_idx" ON "bookingTraveler"("travelerId");

-- CreateIndex
CREATE UNIQUE INDEX "bookingTraveler_bookingId_travelerId_key" ON "bookingTraveler"("bookingId", "travelerId");

-- CreateIndex
CREATE INDEX "bookingItem_agencyId_idx" ON "bookingItem"("agencyId");

-- CreateIndex
CREATE INDEX "bookingItem_bookingId_position_idx" ON "bookingItem"("bookingId", "position");

-- CreateIndex
CREATE INDEX "bookingItem_supplierId_idx" ON "bookingItem"("supplierId");

-- CreateIndex
CREATE INDEX "payment_agencyId_idx" ON "payment"("agencyId");

-- CreateIndex
CREATE INDEX "payment_agencyId_status_dueDate_idx" ON "payment"("agencyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "payment_bookingId_idx" ON "payment"("bookingId");

-- CreateIndex
CREATE INDEX "supplierPayment_agencyId_idx" ON "supplierPayment"("agencyId");

-- CreateIndex
CREATE INDEX "supplierPayment_agencyId_status_dueDate_idx" ON "supplierPayment"("agencyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "supplierPayment_supplierId_idx" ON "supplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "supplierPayment_bookingId_idx" ON "supplierPayment"("bookingId");

-- CreateIndex
CREATE INDEX "exchangeRate_baseCurrency_quoteCurrency_idx" ON "exchangeRate"("baseCurrency", "quoteCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "exchangeRate_baseCurrency_quoteCurrency_source_key" ON "exchangeRate"("baseCurrency", "quoteCurrency", "source");

-- CreateIndex
CREATE INDEX "document_agencyId_idx" ON "document"("agencyId");

-- CreateIndex
CREATE INDEX "document_bookingId_idx" ON "document"("bookingId");

-- CreateIndex
CREATE INDEX "document_travelerId_idx" ON "document"("travelerId");

-- CreateIndex
CREATE INDEX "activity_agencyId_createdAt_idx" ON "activity"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_customerId_createdAt_idx" ON "activity"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_quoteId_createdAt_idx" ON "activity"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_bookingId_createdAt_idx" ON "activity"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_dueAt_idx" ON "activity"("dueAt");

-- CreateIndex
CREATE INDEX "activity_createdById_idx" ON "activity"("createdById");

-- CreateIndex
CREATE INDEX "fieldDefinition_agencyId_entity_position_idx" ON "fieldDefinition"("agencyId", "entity", "position");

-- CreateIndex
CREATE UNIQUE INDEX "fieldDefinition_agencyId_entity_key_key" ON "fieldDefinition"("agencyId", "entity", "key");

-- CreateIndex
CREATE INDEX "fieldOption_agencyId_idx" ON "fieldOption"("agencyId");

-- CreateIndex
CREATE INDEX "fieldOption_fieldId_position_idx" ON "fieldOption"("fieldId", "position");

-- CreateIndex
CREATE INDEX "fieldValue_agencyId_idx" ON "fieldValue"("agencyId");

-- CreateIndex
CREATE INDEX "fieldValue_fieldId_text_idx" ON "fieldValue"("fieldId", "text");

-- CreateIndex
CREATE INDEX "fieldValue_fieldId_number_idx" ON "fieldValue"("fieldId", "number");

-- CreateIndex
CREATE INDEX "fieldValue_fieldId_date_idx" ON "fieldValue"("fieldId", "date");

-- CreateIndex
CREATE INDEX "fieldValue_optionId_idx" ON "fieldValue"("optionId");

-- CreateIndex
CREATE INDEX "fieldValue_userId_idx" ON "fieldValue"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_customerId_key" ON "fieldValue"("fieldId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_quoteId_key" ON "fieldValue"("fieldId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_bookingId_key" ON "fieldValue"("fieldId", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_travelerId_key" ON "fieldValue"("fieldId", "travelerId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_supplierId_key" ON "fieldValue"("fieldId", "supplierId");

-- CreateIndex
CREATE INDEX "savedView_agencyId_entity_shared_idx" ON "savedView"("agencyId", "entity", "shared");

-- CreateIndex
CREATE UNIQUE INDEX "savedView_agencyId_entity_ownerId_name_key" ON "savedView"("agencyId", "entity", "ownerId", "name");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencySettings" ADD CONSTRAINT "agencySettings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencyCounter" ADD CONSTRAINT "agencyCounter_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler" ADD CONSTRAINT "traveler_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler" ADD CONSTRAINT "traveler_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travelerLoyalty" ADD CONSTRAINT "travelerLoyalty_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travelerLoyalty" ADD CONSTRAINT "travelerLoyalty_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travelerLoyalty" ADD CONSTRAINT "travelerLoyalty_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quoteOption" ADD CONSTRAINT "quoteOption_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quoteOption" ADD CONSTRAINT "quoteOption_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quoteItem" ADD CONSTRAINT "quoteItem_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quoteItem" ADD CONSTRAINT "quoteItem_quoteOptionId_fkey" FOREIGN KEY ("quoteOptionId") REFERENCES "quoteOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quoteItem" ADD CONSTRAINT "quoteItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookingTraveler" ADD CONSTRAINT "bookingTraveler_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookingTraveler" ADD CONSTRAINT "bookingTraveler_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookingTraveler" ADD CONSTRAINT "bookingTraveler_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookingItem" ADD CONSTRAINT "bookingItem_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookingItem" ADD CONSTRAINT "bookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookingItem" ADD CONSTRAINT "bookingItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplierPayment" ADD CONSTRAINT "supplierPayment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplierPayment" ADD CONSTRAINT "supplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplierPayment" ADD CONSTRAINT "supplierPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplierPayment" ADD CONSTRAINT "supplierPayment_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "bookingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldDefinition" ADD CONSTRAINT "fieldDefinition_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldOption" ADD CONSTRAINT "fieldOption_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldOption" ADD CONSTRAINT "fieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldValue" ADD CONSTRAINT "fieldValue_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldValue" ADD CONSTRAINT "fieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldValue" ADD CONSTRAINT "fieldValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "fieldOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldValue" ADD CONSTRAINT "fieldValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savedView" ADD CONSTRAINT "savedView_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savedView" ADD CONSTRAINT "savedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
