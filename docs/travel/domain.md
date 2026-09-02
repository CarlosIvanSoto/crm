# Travel data model — read before you touch `packages/travel-db`

The agencies product is a **second product in this monorepo**. It has its own
database (`TRAVEL_DATABASE_URL`, Postgres on 5433), its own Prisma package
(`@travel/db`), its own auth (`@travel/auth`), and its own port range
(app 3010, api 3011). It shares only `@crm/ui`, `@crm/env` and
`@crm/typescript-config`. The full build plan is the approved plan file; this
doc is the set of rules that are not optional.

## Multi-tenant. The agency is the tenant.

- **`Organization` is the agency.** One row per agency. Better Auth's
  `organization` plugin is the real tenancy boundary here, not a singleton.
- **Every business table carries `agencyId`.** Not a join path — a real column,
  with `@@index([agencyId, ...])` on every index. Child tables denormalise it.
- **`agencyId` is never an input.** It comes from
  `session.activeOrganizationId`. A tRPC procedure whose Zod schema accepts
  `agencyId` is a security bug.
- **Services never see the raw client.** They call
  `agencyDb(rawClient, agencyId)` (`@travel/db/tenancy`) and get a Prisma
  `$extends` client that:
  - injects `where: { agencyId }` on every read, `update`, `delete`,
    `updateMany`, `deleteMany`, `aggregate`, `groupBy`, `count`, `upsert`;
  - pins `data.agencyId` on `create`, `createMany`, `update`, `updateMany` and
    `upsert.create` — overriding whatever the caller passed;
  - **throws on `findUnique` / `findUniqueOrThrow`.** Prisma rejects a
    non-unique filter there, so those calls would escape the tenant scope
    silently. Read with `findFirst({ where: { id, agencyId } })`.
- **`TENANT_MODELS` (`@travel/db/tenancy`) is the list.** A new business model is
  added there or it is not scoped.
- `ExchangeRate` is the one deliberate exception — market rates are global, so
  it is not in `TENANT_MODELS`.

## Folios

`nextCounter(tx, agencyId, kind)` (`@travel/db/folio`) runs one atomic
`INSERT … ON CONFLICT DO UPDATE SET value = value + 1 RETURNING value` inside the
same transaction as the row it numbers. `formatFolio(prefix, year, value)` turns
the count into `COT-2026-0142`. The prefix comes from `AgencySettings`.

## `BookingItem.details` / `QuoteItem.details` is a discriminated union

The `details` JSON column is parsed once, at read, with Zod, in
`@travel/validation/itinerary-item`. `packages/validation/src/agent-manifest.ts`
is the pattern. The schema describes what is **stored**, not the loosest thing
that parses. A parse failure is an error with a message, never a swallowed empty
object.

## Same rules as the CRM

No code comments. Parse at the boundary. Constants in one config module per
area. A server page computes, a client component renders. Reports in ASD-STE100
with a `## Issues` list.
