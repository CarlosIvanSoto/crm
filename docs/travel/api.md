# Travel API and app — read before you touch `apps/travel-api` or `apps/travel-app`

Status: **not built yet.** Fase 0 (monorepo scaffolding) and Fase 1
(`packages/travel-db`) are done. Fase 2 (`apps/travel-api`) and Fase 3
(`apps/travel-app`) are in the approved plan file and not started. This doc is
the contract they must follow.

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
`canSeeMargins`, `canRecordPayment`) live in `@travel/auth` and gate the service
**and** the UI control, so the button and the 403 never disagree.

## Cookie prefix

`AUTH_COOKIE_PREFIX = "travel"` — set in both `advanced.cookiePrefix` in
`auth.ts` and `getSessionCookie(request, { cookiePrefix })` in the app's
`proxy.ts`. One alone redirects every signed-in request.
