# Travel API and app — read before you touch `apps/travel-api` or `apps/travel-app`

Status: **built.** Fases 0–7B are done. `apps/travel-api` has 17 routers and 136
procedures. `apps/travel-app` has the shell, the six entities, the dashboard,
commissions, the task inbox, the record-sheet timeline, the settings screens,
the public quote document and documents. `docs/travel/status.md` tracks what
is left. This doc is the contract the code follows.

## The API is the CRM's API, minus the intelligence, plus one middleware

- Six infra folders are copied from `apps/api/src` almost unchanged: `config`,
  `database`, `trpc`, `logging`, `cache`, `health`.
- `LoggingModule` stays **first** in `AppModule`. `bodyParser: false` in
  `createApp` — Better Auth needs the raw body.
- `src/generated/server.ts` is generated **and committed**. `build` never
  regenerates it; only `check-types` and `dev` do.
- **Intelligence never lives in the API.** No vendor client, no supplier-email
  parsing, no scoring. That is a future `apps/travel-agent`.

## `AgencyMiddleware` — the piece the CRM does not have

Runs after `AuthMiddleware`. Reads `session.activeOrganizationId`, looks up the
caller's `Member` row, and narrows the context to
`AgencyTrpcContext = AuthedTrpcContext & { agencyId, role }`. Every domain
router carries `@UseMiddlewares(AuthMiddleware, AgencyMiddleware)` at the class.
**No middleware means the procedure is public — there is no other guard.**

Services do `const scoped = agencyDb(this.raw, ctx.agencyId)` per method. They
never touch the raw client. See `docs/travel/domain.md` for the `agencyDb`
contract.

## Inherited from `docs/api.md` without change

Thin routers (Zod in, service out; Prisma only in `*.service.ts`). Filter, sort
and paginate in Prisma with the copied `list-input.ts` helpers. Never
interpolate `sort` into a field name. Archive first, purge later. Services throw
Nest exceptions; `DomainErrorMiddleware` maps them. Never `console.log`; never
log headers, query strings or bodies.

## Roles

`owner`, `admin`, `agent`, `accountant`. Predicates (`canManageAgency`,
`canSeeMargins`, `canRecordPayment`, `canManageCommission`) live in `@travel/auth`
and gate the service **and** the UI control, so the button and the 403 never
disagree.

## `commissions` router

`Commission` is the advisor's cut of one booking (`docs/travel/money.md`).
`list` / `byBooking` read; `create`, `update`, `approve`, `pay`, `void`,
`remove`, `recalculate`, `bulk-approve`, `bulk-pay` write and are gated by
`canManageCommission`. `reports/advisors` and `reports/suppliers` aggregate in
base currency; `reports/suppliers` needs `canSeeMargins`. An `agent` sees only
their own rows in `list` and `byAdvisor` — the service sets the `userId` filter,
it is never an input. `agencyId` is never an input either.

`agency.profile` and `agency.updateProfile` carry `defaultCommissionBasis` and
`defaultCommissionRate` — the defaults a new commission form starts from, not a
rule that runs on its own. `updateProfile` still gates on `canManageAgency`.

## `quoteShare` and `publicQuote` routers — the quote document

`QuoteShare` is a one-way token that turns one `Quote` into a public web page
(`docs/travel/money.md`, `docs/travel/domain.md`'s token-resolution exception).
Two routers, one module (`apps/travel-api/src/quote-share/`):

- **`quoteShare`** — `@UseMiddlewares(AuthMiddleware, AgencyMiddleware)`, same
  as every other domain router. `status` reads the live share for a quote
  (never the plaintext token — it isn't stored). `create` revokes any live
  share and mints a new one, returning its URL **once**. `revoke` ends the live
  share. `send` mints a fresh token (a "resend" cannot reuse the old one; only
  its `sha256` is on file), emails it through `sendQuoteLink`
  (`TRAVEL_RESEND_API_KEY` + `TRAVEL_QUOTE_FROM`, optional, never throws — the
  capability pattern), and stamps the quote `SENT` if it was still `DRAFT`.
  Every write scopes through `agencyDb`, and `quote(id)` in
  `apps/travel-app/lib/trpc/cache.ts` invalidates `quoteShare.status`.
- **`publicQuote`** — **no `@UseMiddlewares` at all.** A tRPC router with no
  middleware is not merely unauthenticated in the REST sense: `AuthMiddleware`
  and `AgencyMiddleware` are the only guards, and neither runs. This is the
  **one** router in the product built to be called by someone with no session.
  `view` resolves the token, counts the visit, logs one `Activity` `SYSTEM` on
  the first view only, and returns a hand-picked output schema —
  `agency`, `quote`, `customer`, `options[].items[]` — that carries no `cost*`,
  `margin*`, `ownerId`, `customerId` or `userId` field. Nothing there is a
  redaction of a bigger object; the Zod output schema is the whitelist, so a
  field can't leak by a future edit adding it upstream. `accept` picks an
  option and a name; it moves the quote to `ACCEPTED` and freezes
  `acceptedOptionId` / `acceptedByName`, but **does not create a booking** —
  `quotes.accept` (the advisor's own procedure) still does that, and its guard
  only checks `quote.booking`, not `quote.status`, so the two never race.

## `activities` router — tasks and reminders

`Activity` is one row per note, call or task on a customer, quote or booking.
`timeline` / `timelineCounts` render a record sheet's Timeline tab. `create`
logs one. `tasks` is the advisor task inbox: `type = TASK`, `completedAt = null`,
a `window` of `overdue | today | week | all` derived from `dueAt`, paginated with
`listInput`, with `window` and `assignedTo` facet counts.

`Activity.assignedToId` is who owns a task. `create` sets it to `assignedToId ??`
the caller; a non-null `assignedToId` must be an agency member or `create` throws
`BadRequestException`. `assign`, `updateTask`, `remove` and `complete` need the
assignee or a role with `canSeeMargins` — same "sees all vs. sees own" line as
commissions, set by the service, never an input. `agencyId` is never an input.
`completeMany` closes a page of tasks with `runBulk`.

The reminder sweep is `POST|GET /internal/sync/reminders`, a cron controller that
copies `rates.controller.ts`: `@AllowAnonymous`, a `Bearer <TRAVEL_CRON_SECRET>`
check with `timingSafeEquals`, 503 with no secret, 403 on mismatch. It walks
every agency (capped by `REMINDERS.sweep.maxAgenciesPerRun`) and runs four
steps per agency:

- **Overdue task** — mails the assignee, stamps `reminderSentAt`, writes no row.
  It does not re-mail inside `REMINDERS.task.resendAfterMs` (7 days).
- **Overdue payment** — writes a `TASK` row per `SCHEDULED` payment past due,
  `sourceKey = payment-overdue:<paymentId>`.
- **Near departure** — writes a `TASK` row per booking leaving inside
  `REMINDERS.departure.windowDays` (7), `sourceKey = departure:<bookingId>`.
- **Document expiring** — writes a `TASK` row per traveler whose
  `documentExpiresAt` falls inside `REMINDERS.travelDocument.windowDays` (30)
  and who is on a future, non-cancelled booking, assigned to that booking's
  owner. `sourceKey = document-expiry:<travelerId>:<expiry date>` — the date
  is in the key on purpose, so a renewed passport warns again.

`@@unique([agencyId, sourceKey])` plus `createMany({ skipDuplicates: true })`
makes steps two through four idempotent with no prior read; a human task has a
null `sourceKey` and never collides. The endpoint fails closed. The mail fails
open: with no `TRAVEL_RESEND_API_KEY` or `TRAVEL_REMINDER_FROM` the sweep still
writes and stamps, and sends nothing. `vercel.json` runs it at `0 8 * * *`.

`dashboard.summary` carries `tasks: { open, overdue }`. `scope: "me"` counts only
tasks assigned to the caller.

## `documents` router — vouchers, tickets, invoices, ID documents

`Document` is anchored to a `Booking` or a `Traveler` (`docs/travel/domain.md`).
Storage is `@vercel/blob`, always `access: "private"` — a passport scan never
lives at a public URL.

- **The upload is three calls, and the bytes never touch the API.**
  `documents.uploadToken` validates the anchor, the content type and the size
  against `DOCUMENTS.upload`, mints a `pathname` scoped
  `agencies/<agencyId>/<anchorId>/…`, and returns a client token from
  `generateClientTokenFromReadWriteToken` — it does not write a row. The
  browser then calls `put()` from `@vercel/blob/client` directly against the
  blob store. `documents.create` registers the row afterward, and refuses any
  `pathname` that does not start with the caller's own `agencies/<agencyId>/`
  prefix — a second barrier past the token itself.
- **`documents.downloadUrl` signs a fresh URL per request**, via
  `issueSignedToken` + `presignUrl({ operation: "get" })`, good for
  `DOCUMENTS.download.urlTtlMs` (5 minutes). `documentEntryOutput` carries
  neither `pathname` nor `url` — the signed URL is the only way to reach the
  file.
- **Without `TRAVEL_BLOB_READ_WRITE_TOKEN`, `uploadToken` throws
  `ServiceUnavailableException`.** `list`, `byId` and `remove` keep working —
  the capability pattern, same as `document-storage.ts` and
  `packages/db/src/blob.ts` in the CRM.
- **Any agency member can upload.** An `agent` sees only documents on their
  own bookings, on travelers on their own bookings, or that they uploaded
  themselves — the same `canSeeMargins`-gated "sees all vs. sees own" line as
  `activities` and `commissions`, set by the service, never an input.
  `update` (rename, change `kind`) needs only visibility; `remove` needs the
  uploader or a role with `canSeeMargins`.
- **Delete is hard delete, storage first.** `del(pathname)` runs before the
  row is deleted; a storage failure is logged and does not block the row's
  removal — an orphaned blob is the accepted risk, not a stuck record.

## Cookie prefix

`AUTH_COOKIE_PREFIX = "travel"` — set in both `advanced.cookiePrefix` in
`auth.ts` and `getSessionCookie(request, { cookiePrefix })` in the app's
`proxy.ts`. One alone redirects every signed-in request.

## The app — `apps/travel-app`

- **Port 3010.** Talks to `apps/travel-api` on 3011 through
  `app/api/[...path]/route.ts`, which proxies `/api/trpc` and `/api/auth` to
  `TRAVEL_API_URL`.
- **The URL slug is the agency, and it is tenancy.** `proxy.ts` redirects a
  foreign slug to the caller's own. `app/(app)/[agency]/layout.tsx` repeats the
  check with `notFound()` because the proxy is not an authorization.
- **`agency.profile` is the `workspace.get` of travel.** It returns `slug`,
  `viewerRole` and `canManage`. The layout and every settings screen read
  `canManage` from it — one source, so the button and the 403 never disagree.
- **A client component never imports a server package.** `@travel/auth` (the
  barrel), `@travel/db` and `travel-api` service code reach Prisma. A
  `"use client"` file may import `@travel/auth/client`, `@travel/auth/cookies`,
  `@travel/auth/agency`, `@travel/db/fields-shape` (a leaf module, no Prisma),
  `@crm/ui`, the tRPC client and React. Nothing else without checking.
- **Money is `number` in major units.** Use `formatAmount` / `formatAmountCompact`
  from `@crm/ui/lib/format`, never `formatMoney` (it divides by 100). Only the
  `*BaseAmount` columns are summed. A missing rate is shown next to the total,
  never treated as zero.
- **`lib/trpc/cache.ts`** is the invalidation facade. A new mutation adds a call
  there, not a list of query keys at the call site.

### Routes

```
app/(landing)/   sign-in, sign-up, new-agency, accept/[invitationId]
app/(public)/q/[token]/   the quote document — no session, PUBLIC in proxy.ts
app/(app)/[agency]/
  page.tsx                 dashboard — dashboard.summary({ scope })
  customers/ travelers/ suppliers/ quotes/ bookings/   list + record sheet
  payments/                charges and payables on one screen
  commissions/             list + bulk approve/pay; reports/ has by advisor / by supplier
  tasks/                   the advisor task inbox
  documents/               vouchers, tickets, invoices, ID documents; opens the anchor record
  settings/
    (General)              agency.profile / updateProfile — tax data, timezone, logo
    members/               members, setRole, removeMember, invitations, invite
    currencies/            currency.settings + setBaseCurrency / rate mutations
    commissions/           updateProfile with defaultCommissionBasis / defaultCommissionRate
    fields/                fields.* for the five entities, entity in ?entity
    folios/                updateProfile with quotePrefix / bookingPrefix
```

The commissions list has no record sheet — a row opens the parent booking's
sheet on its Commissions tab. The same `CommissionsPanel` is that tab and the
list's not — it is booking-scoped through a required `bookingId` prop.

The quote record sheet's Share tab (`SharePanel`) creates and revokes the
public link and sends it by email; `app/(public)/q/[token]/` is what the
customer opens. `packages/ui/src/styles/print.css` (exported as
`@crm/ui/print.css`) is the printed layout — `[data-print="hide"]` drops the
accept form and the print button from the page a customer saves to PDF.
