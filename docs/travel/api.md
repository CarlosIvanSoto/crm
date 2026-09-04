# Travel API and app — read before you touch `apps/travel-api` or `apps/travel-app`

Status: **built.** Fases 0–5B are done. `apps/travel-api` has 14 routers and 122
procedures. `apps/travel-app` has the shell, the six entities, the dashboard,
commissions, the task inbox, the record-sheet timeline and the settings screens.
`docs/travel/status.md` tracks what is left. This doc is the contract the code
follows.

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
every agency (capped by `REMINDERS.sweep.maxAgenciesPerRun`) and runs three
steps per agency:

- **Overdue task** — mails the assignee, stamps `reminderSentAt`, writes no row.
  It does not re-mail inside `REMINDERS.task.resendAfterMs` (7 days).
- **Overdue payment** — writes a `TASK` row per `SCHEDULED` payment past due,
  `sourceKey = payment-overdue:<paymentId>`.
- **Near departure** — writes a `TASK` row per booking leaving inside
  `REMINDERS.departure.windowDays` (7), `sourceKey = departure:<bookingId>`.

`@@unique([agencyId, sourceKey])` plus `createMany({ skipDuplicates: true })`
makes steps two and three idempotent with no prior read; a human task has a null
`sourceKey` and never collides. The endpoint fails closed. The mail fails open:
with no `TRAVEL_RESEND_API_KEY` or `TRAVEL_REMINDER_FROM` the sweep still writes
and stamps, and sends nothing. `vercel.json` runs it at `0 8 * * *`.

`dashboard.summary` carries `tasks: { open, overdue }`. `scope: "me"` counts only
tasks assigned to the caller.

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
app/(app)/[agency]/
  page.tsx                 dashboard — dashboard.summary({ scope })
  customers/ travelers/ suppliers/ quotes/ bookings/   list + record sheet
  payments/                charges and payables on one screen
  commissions/             list + bulk approve/pay; reports/ has by advisor / by supplier
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
