# Producto de viajes — estado de implementación

Fecha de corte: 2026-09-05. Plan aprobado: `docs/travel/plan_01.md`. La Fase 2
se corta en dos rebanadas: `docs/travel/plan_02.md` es la Fase 2A.

Actualizado para cerrar la Fase 9 (auditoría de datos y semilla de
demostración).

Este archivo dice qué está hecho, qué falta y en qué orden seguir. Las reglas de
cada área están en `docs/travel/domain.md`, `docs/travel/money.md` y
`docs/travel/api.md`.

---

## Resumen de fases

| Fase | Alcance | Estado |
| --- | --- | --- |
| 0 | Andamiaje del monorepo | HECHO |
| 1 | `packages/travel-db` (`@travel/db`) | HECHO |
| 2A | `@travel/validation`, `@travel/auth`, infra de `apps/travel-api`, `AgencyMiddleware`, módulos `agency`/`users`/`customers`/`quotes`/`bookings` | HECHO |
| 2B | Módulos `travelers`/`suppliers`/`payments`/`activities`/`fields`/`saved-views`, `currency` completo | HECHO |
| 3A | Cableado de `apps/travel-app`, auth, shell, `customers` de punta a punta | HECHO |
| 3B | `travelers`/`suppliers`/`quotes`/`bookings`/`payments` en la app | HECHO |
| 3C | Tablero (módulo `dashboard` en la API) y ajustes | HECHO |
| 4A | Comisiones — modelo `Commission`, módulo API, gating de margen | HECHO |
| 4B | Comisiones en la app | HECHO |
| 5A | Tareas y recordatorios — `Activity.assignedToId`, bandeja en el router `activities`, barrido con cron | HECHO |
| 5B | Timeline en las fichas, bandeja de tareas y tarjeta del tablero en la app | HECHO |
| 6A | Documento de cotización — modelo `QuoteShare`, routers `quoteShare`/`publicQuote` | HECHO |
| 6B | Documento de cotización en la app — página pública, pestaña Share, impresión | HECHO |
| 7A | Documentos — `Document.pathname`, módulo `documents`, recordatorio de vencimiento | HECHO |
| 7B | Documentos en la app — pestaña en reserva/pasajero, página `/documents` | HECHO |
| 8A | `apps/travel-agent` y el disparador — `AgentTask`, `AgentConversation`, seguimiento de cotización | HECHO |
| 8B | Pestaña Agent en la ficha de cotización | HECHO |
| 9 | Auditoría de datos y semilla de demostración — `packages/travel-db/prisma/seed/` | HECHO |

El plan de la Fase 3 es `docs/travel/plan_03.md`. Se corta en tres rebanadas.

El plan de la Fase 4 es `docs/travel/plan_04.md`. Cubre **solo comisiones**. Se
corta en dos rebanadas: 4A datos y API (HECHO), 4B la app (HECHO).

El plan de la Fase 5 es `docs/travel/plan_07.md`. Cubre **solo tareas y
recordatorios**. Se corta en dos rebanadas: 5A datos y API (HECHO), 5B la app
(HECHO).

El plan de la Fase 6 es `docs/travel/plan_08.md`. Cubre **solo el documento de
cotización**. Se corta en dos rebanadas: 6A datos y API, 6B la app.

El plan de la Fase 7 es `docs/travel/plan_09.md`. Cubre **solo documentos**
(vouchers, boletos, facturas, identificación). Se corta en dos rebanadas: 7A
datos y API (HECHO), 7B la app (HECHO).

El plan de la Fase 8 es `docs/travel/plan_10.md`. Cubre `apps/travel-agent` y el
disparador. Se corta en dos rebanadas: 8A datos, agente y API (HECHO), 8B la app
(HECHO).

El plan de la Fase 9 es `docs/travel/plan_11.md`. Cubre **solo la semilla de
demostración**: audita los datos locales y siembra un juego amplio que ejercita
cada pantalla, filtro y regla. HECHO.

---

## Fase 0 — HECHO

Cambios en archivos existentes:

| Archivo | Cambio |
| --- | --- |
| `docker-compose.yml` | Servicio `travel-postgres` en 5433, volumen `travel-postgres` |
| `.env.example` | Sección `# Travel` con 11 variables `TRAVEL_*` documentadas |
| `turbo.json` | 11 variables `TRAVEL_*` en `globalPassThroughEnv` |
| `package.json` | Alias raíz `travel:migrate/seed/reset/studio/deploy/push/test` |
| `biome.jsonc` | 3 overrides para `apps/travel-app/**` y `apps/travel-api/**` |
| `knip.json` | Bloques para `apps/travel-api`, `apps/travel-app`, `packages/travel-db` |
| `.oxlintrc.json` | Generados ignorados; override anti-slop para `tenancy.ts` con razón |
| `.github/workflows/ci.yml` | Segundo Postgres 5433, env `TRAVEL_*`, paso `travel:deploy` |
| `AGENTS.md` | 3 renglones en la tabla índice hacia `docs/travel/*` |

---

## Fase 1 — HECHO

Paquete nuevo `packages/travel-db`, publicado como `@travel/db`.

### Archivos

```
packages/travel-db/
  package.json          scripts travel:* propios, deps mínimas
  tsconfig.json         extiende @crm/typescript-config/internal-package.json
  turbo.json            tareas travel:* + dev:prepare + build
  .gitignore            src/generated/
  prisma.config.ts      datasource: env("TRAVEL_DATABASE_URL")
  prisma/schema.prisma  25 modelos, 15 enums — validate y generate pasan
  prisma/seed.ts        siembra 2 agencias con datos reales
  scripts/
    require-local-db.ts fork, lee TRAVEL_DATABASE_URL
    test-db.ts          fork, crea travel_test y migra
    prepare-dev.ts      fork, migrate deploy + generate + drift check
  src/
    client.ts           singleton crudo, TRAVEL_DATABASE_URL / _TEST_
    tenancy.ts          agencyDb(client, agencyId) — la guarda
    folio.ts            nextCounter() atómico, formatFolio()
    json.ts             JsonObject / JsonValue
    index.ts            barril
  test/
    tenancy.spec.ts     6 casos de aislamiento entre dos agencias
```

### Modelo de datos

- **Better-auth**: `User`, `Session`, `Account`, `Verification`, `RateLimit`,
  `Organization`, `Member`, `Invitation`, `Apikey`. `Organization` es la agencia.
- **Negocio** (toda tabla con `agencyId` + `@@index([agencyId, ...])`):
  `AgencySettings`, `AgencyCounter`, `Customer`, `Traveler`, `TravelerLoyalty`,
  `Supplier`, `Quote`, `QuoteOption`, `QuoteItem`, `Booking`, `BookingTraveler`,
  `BookingItem`, `Payment`, `SupplierPayment`, `Document`, `Activity`,
  `FieldDefinition`, `FieldOption`, `FieldValue`, `SavedView`.
- **Global** (no tenant): `ExchangeRate`.
- **Dinero de dos lados** en `QuoteItem` y `BookingItem`: `costAmount` +
  `costCurrency`, `sellAmount` + `sellCurrency`, `costBaseAmount`,
  `sellBaseAmount`, `baseCurrency`, `fxRate`, `fxRateAt`. Solo `*BaseAmount` se
  suma.

### La guarda de tenencia — `agencyDb`

Extensión de Prisma (`$extends`). Para todo modelo de `TENANT_MODELS`:

- inyecta `where: { agencyId }` en `findFirst`, `findMany`, `count`, `aggregate`,
  `groupBy`, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`;
- fija `data.agencyId` en `create`, `createMany`, `update`, `updateMany` y
  `upsert.create`, sobrescribiendo lo que pase el llamador;
- **lanza** en `findUnique` y `findUniqueOrThrow`.

Regla: `agencyId` nunca es input. Viene de `session.activeOrganizationId`.

### Verificado

- `bunx prisma validate` — pasa.
- `bunx prisma generate` — pasa.
- `bunx tsc --noEmit` en el paquete — pasa.
- `bunx biome check packages/travel-db` — pasa (2 warnings iguales a `@crm/db`).
- `bunx oxlint --config .oxlintrc.json packages/travel-db` — pasa.

### Cerrado en Fase 1

- **Migración SQL inicial** `20260902204400_init` — cubre 30 modelos y 15 enums.
- **`test/tenancy.spec.ts`** — 11 casos ahora (6 originales + `findUniqueOrThrow`,
  `createMany`, `upsert`, paso de modelo no tenant, escritura anidada que falla
  cerrada). Pasa contra Postgres 5433.
- **`src/currency.ts` y `src/fx.ts`** — copiados de `@crm/db`. Subpath exports
  `@travel/db/currency` y `@travel/db/fx`. `ExchangeRate` sigue global.

---

## Fase 2A — HECHO

Rebanada vertical: los dos paquetes nuevos, la infraestructura de la API, el
`AgencyMiddleware` y cinco módulos de dominio. Dos agencias operan de punta a
punta y el aislamiento se mide.

### Archivos

```
packages/travel-validation/       @travel/validation
  src/itinerary-item.ts           itineraryDetails (unión discriminada),
                                  parseItineraryDetails (lanza),
                                  readItineraryDetails (degrada)
  src/index.ts                    barril + parse()
  test/itinerary-item.spec.ts     6 casos

packages/travel-auth/             @travel/auth
  src/cookies.ts                  AUTH_COOKIE_PREFIX = "travel"
  src/env.ts                      lee TRAVEL_*
  src/agency.ts                   AGENCY_ROLES, predicados, agencyRoleOf()
  src/invitations.ts              sendAgencyInvitation() — opcional, nunca lanza
  src/auth.ts                     betterAuth: email+password, organización real
  src/client.ts                   createAuthClient + organizationClient()
  src/index.ts                    barril
  README.md                       flujo obligatorio de travel:auth:generate

apps/travel-api/                  travel-api
  src/main.ts                     TRAVEL_PORT ?? 3011
  src/create-app.ts              bodyParser:false, helmet, /rest, Swagger
  src/app.module.ts              LoggingModule primero
  src/config/env.validation.ts   TRAVEL_*, sin ALLOWED_SIGN_IN
  src/{database,logging,cache,health}/   copiados de apps/api casi sin cambio
  src/trpc/                       list-input, error-formatter, openapi,
                                  middlewares/{auth,domain-error,logging}
  src/trpc/middlewares/agency.middleware.ts   la pieza nueva
  src/trpc/context.types.ts      + AgencyTrpcContext
  src/currency/conversion.service.ts   baseCurrencyFor(), itemFields() x2 lados
  src/travel/{bulk,values,itinerary}.ts   helpers compartidos
  src/{agency,users,customers,quotes,bookings}/   módulo de 4 archivos
  src/generated/server.ts        generado y commiteado (5 routers, 46 procs)
  scripts/{chmod-trpc-binary.mjs,build-func.mjs}   despliegue serverless
  api/index.ts  vercel.json  turbo.json  tsconfig.json
  test/setup.ts  helpers.ts
  test/agency-id-inputs.spec.ts  ningún esquema Zod acepta agencyId
  test/tenancy.spec.ts           dos agencias, lectura cruzada da NOT_FOUND
  test/folio.spec.ts             cada agencia lleva su propia serie
  test/agency-middleware.spec.ts sin activeOrganizationId da FORBIDDEN
```

### Decisiones

- **Correo de invitación opcional vía Resend.** `TRAVEL_RESEND_API_KEY` +
  `TRAVEL_INVITATION_FROM`. Faltando cualquiera, `agency.invite` devuelve un
  enlace copiable y no lanza.
- **`travel:auth:generate` propio.** Script con nombre `travel:*` para que el
  fan-out de la raíz no lo corra junto al del CRM. Revisar el diff a mano: el
  generador borra las relaciones inversas de `Organization`.

### Cambios fuera de los paquetes nuevos

| Archivo | Cambio |
| --- | --- |
| `.env.example` | `TRAVEL_RESEND_API_KEY`, `TRAVEL_INVITATION_FROM` |
| `turbo.json` | ambas en `globalPassThroughEnv` |
| `package.json` | alias `travel:auth:generate` |
| `.oxlintrc.json` | overrides de `packages/travel-validation/src/**` y `apps/travel-api/src/logging/**` |
| `packages/travel-db/package.json` | exports `./currency` y `./fx` |
| `packages/travel-db/test/tenancy.spec.ts` | 5 casos nuevos |

### Verificado

- `bun run check-types` — 19/19.
- `bun run lint` — 13/13 (warnings de barrel iguales a `@crm/auth`).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-api test` — 64 casos, contra Postgres 5433.
- `bun run --filter=@travel/db test` — 11 casos.
- `bun run --filter=@travel/validation test` — 6 casos.

### Alcance de 2A

- **`customers`** — lista con facetas (tipo, dueño), ficha, archivar/restaurar/
  purgar, bulk, opciones para pickers.
- **`quotes`** — cotización con folio consecutivo, `setOptions` reemplaza el
  conjunto de opciones y sus renglones, `accept` crea la reserva copiando los
  renglones de la opción elegida.
- **`bookings`** — expediente con folio, `setItems` reemplaza renglones,
  `setTravelers` crea `Traveler` + `BookingTraveler` en una transacción,
  totales en moneda base.
- **`agency`** — perfil (`AgencySettings`), miembros, invitaciones con enlace,
  `setRole`/`removeMember` con protección del último `owner` (`FOR UPDATE`).
- **`users`** — `me` y lista de asesores **filtrada por membresía**.
- **`currency`** — solo `ConversionService`. La moneda base sale de
  `AgencySettings.baseCurrency`, una por agencia. `itemFields` corre dos veces
  por renglón: lado costo y lado venta.

### Reglas del `agencyDb` que respetan los servicios

1. **Escrituras anidadas sin alcance.** Los hijos se crean en llamadas aparte
   dentro del mismo `$transaction`, cada una por el cliente con alcance.
2. **`findUnique` lanza.** `AgencySettings` se lee por `findFirst`.
3. **`$queryRaw` esquiva la extensión.** `nextCounter` pasa `agencyId` a mano;
   `create`/`accept` corren en `this.db.$transaction` con `agencyId` explícito en
   el `data` y en cada `where`.
4. **Ninguna FK compuesta.** Cada `customerId`/`quoteId` entrante se relee por el
   cliente con alcance antes de escribir.

### Comandos

```sh
docker compose up -d
bun install
bun run travel:deploy
bun run travel:test
bun run --filter=@travel/db test
bun run --filter=travel-api test
bun run --filter=@travel/validation test
```

---

## Fase 2B — HECHO — el resto de `apps/travel-api`

Seis módulos de dominio más el módulo `currency` completo, sobre la misma app,
con la forma de 4 archivos y las reglas del `agencyDb`.

### Archivos

```
packages/travel-db/src/fields.ts        copiado de @crm/db, sin campos de agente
packages/travel-db/src/fields-shape.ts  entidades CUSTOMER/TRAVELER/QUOTE/BOOKING/SUPPLIER
packages/travel-db/package.json         exports ./fields y ./fields-shape
packages/travel-validation/src/saved-view.ts   copiado de packages/validation
packages/travel-validation/package.json exports ./saved-view

apps/travel-api/src/
  travel/activity-stamp.service.ts       toca Customer.lastActivityAt y Booking.lastActivityAt
  travel/travel.module.ts                @Global(), provee ActivityStampService
  currency/currency-config.ts            constantes de tasas y fill
  currency/conversion.service.ts         + unconverted(), fillMissing(), fillMissingAllAgencies()
  currency/rates.service.ts              open.er-api.com, una base por moneda de AgencySettings
  currency/rates.controller.ts           /internal/sync/rates, TRAVEL_CRON_SECRET, falla cerrado
  currency/currency.service.ts           pantalla de ajustes por agencia, canManageAgency
  currency/currency.router.ts            alias currency
  travelers/     suppliers/     payments/     activities/     fields/     saved-views/
  generated/server.ts                    12 routers, 104 procedimientos
  test/agency-id-inputs.spec.ts          + 7 módulos nuevos, > 40 esquemas
  test/payments.spec.ts                  OVERDUE derivado, roles, totales
  test/fields.spec.ts                    valores por registro, aislamiento entre agencias
```

### Decisiones

- **`currency` per-agencia.** La moneda base sale de `AgencySettings.baseCurrency`,
  una por agencia. `RatesService` refresca una base por cada moneda distinta en
  uso. `ExchangeRate` sigue global; un override `MANUAL` de una agencia afecta a
  las que comparten esa base. `refreshedAt` sale de `max(asOf)` de las filas
  `FETCHED`; no hay `AppSetting`.
- **Cambiar la moneda base no re-tasa lo ya convertido.** `money.md` dice que la
  tasa se congela. `setBaseCurrency` solo corre `fillMissing`: llena las filas sin
  tasa; las ya convertidas conservan su base.
- **`fields` sin agente.** El CRM dispara backfill del agente al crear un campo.
  Viajes no: "la inteligencia nunca vive en la API". Sin `agentFilled`,
  `agentBrief` ni `AgentModule`.
- **`activities` sin `emailThread` ni `calendarEvent`.** El modelo de viajes no
  los tiene. Anclas: `customerId`, `quoteId`, `bookingId`.
- **`payments`:** `OVERDUE` se deriva en la respuesta de
  `status = SCHEDULED AND dueDate < now()`. El filtro `status` entiende el valor
  derivado. `canRecordPayment` (admin o contable) guarda toda mutación.

### Cambios fuera de los módulos nuevos

| Archivo | Cambio |
| --- | --- |
| `.oxlintrc.json` | `packages/travel-db/src/fields{,-shape}.ts` y `apps/travel-api/src/fields/**` en el override de campos |
| `apps/travel-api/src/app.module.ts` | `TravelModule` + 6 módulos + `PaymentsModule` |
| `apps/travel-api/src/currency/currency.module.ts` | `RatesController`, `CurrencyService`, `CurrencyRouter` |

### Verificado

- `bun run check-types` — 19/19.
- `bun run lint` — 13/13.
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-api test` — 158 casos, contra Postgres 5433.
- `bun run --filter=@travel/db test` — 11 casos.
- `bun run --filter=@travel/validation test` — 6 casos.
- Arranque real: `/health` responde `up`, `/openapi.json` expone 88 rutas, el
  cron `/internal/sync/rates` está registrado.

### Comandos

```sh
bun run travel:test
bun run --filter=travel-api test
curl localhost:3011/health
open localhost:3011                  # Swagger con el puente REST
```

---

## Fase 3A — HECHO — cableado, auth, shell y `customers`

Rebanada vertical de `apps/travel-app`. Dos cuentas en dos agencias operan la app
y la fuga entre ellas se mide desde el navegador.

### Promociones a `packages/ui` (antes de 3A)

| Archivo | Cambio |
| --- | --- |
| `packages/ui/src/lib/list-search-params.ts` | Nuevo. Promovido de `apps/app`. `ListTableConfig` gana `reserved?: ReadonlySet<string>` |
| `packages/ui/src/hooks/use-table-query.ts` | Nuevo. Promovido de `apps/app`. `SavedViewFilters` sale de `../lib/table-query`, no de `@crm/validation` |
| `packages/ui/src/lib/table-query.ts` | `+ export type SavedViewFilters` |
| `packages/ui/src/lib/format.ts` | `+ formatAmount`, `+ formatAmountCompact` — montos en unidades mayores, no centavos |
| `packages/ui/package.json` | `+ "zod": "^4.4.3"` |

`apps/app` reapunta: `components/data-table/list-search-params.ts` es un
envoltorio de 3 líneas que inyecta `RESERVED_SEARCH_PARAM_KEYS`;
`use-table-query.ts` se borró y los 6 `*-table.tsx` + `saved-views-menu.tsx` +
`list-search.tsx` importan de `@crm/ui`. `bun run --filter=app check-types` pasa.

### Cambios en `packages/travel-auth`

| Archivo | Cambio |
| --- | --- |
| `src/auth.ts` | `acceptUrl` pasa de `/aceptar/${id}` a `/accept/${id}` |
| `src/client.ts` | `+ signUp` en el destructure de `authClient` |

### Archivos nuevos — `apps/travel-app`

```
package.json          name "travel-app", "dev": "next dev --port 3010"
next.config.ts        transpilePackages ["@crm/ui","@travel/auth","@travel/db"]
postcss.config.mjs    re-export de @crm/ui/postcss.config
components.json  tsconfig.json  turbo.json  .gitignore
proxy.ts              la guarda de agencia. PUBLIC = sign-in/sign-up/accept.
                     Sin cookie → /sign-in. Sin agencia → /new-agency.
                     Slug ajeno → reescribe al slug propio.

lib/
  env.ts             API_URL = NEXT_PUBLIC_TRAVEL_API_URL ?? :3011
  agency-url.ts       agencyUrl(slug, path)
  use-agency-url.ts   useAgencySlug(), useAgencyUrl()
  agency-gate.ts      readAgencyGate() — lee agency.profile, Zod en la frontera
  session.ts          getSession/requireSession sobre @travel/auth
  sign-out.ts  roles.ts  record-href.ts  search-param-keys.ts
  api-proxy-response.ts   copia literal de apps/app
  trpc/{client.tsx,server.ts,hydrate.tsx,query-client.ts,types.ts}
  trpc/cache.ts       useTravelCache — fachada de dominio de viajes

app/
  layout.tsx          import "@crm/ui/globals.css" + providers
  api/[...path]/route.ts   proxy a TRAVEL_API_URL (sirve /api/trpc y /api/auth)
  (landing)/
    page.tsx          redirige a /sign-in
    sign-in/          correo+contraseña, Google cuando isGoogleConfigured()
    sign-up/          authClient.signUp.email → /new-agency
    new-agency/       authClient.organization.create + setActive
    accept/[invitationId]/   authClient.organization.acceptInvitation
  (app)/[agency]/
    layout.tsx        header + rail + RecordSheetHost. notFound() si slug ≠ profile.slug
    page.tsx          tablero — marcador de posición hasta 3C
    customers/        page + search-params + table + bulk-actions + create-sheet
    customers/[customerId]/page.tsx   redirige a ?record=customer:<id>

components/
  page-shell, page-transition, responsive-sheet, mobile-nav, theme-provider,
  local-date-time, inline-script, detail-sheet, auth-shader   — copia de apps/app
  auth-shell.tsx     copia adaptada
  app-header.tsx  app-icon-rail.tsx   — nuevos, con la nav de viajes
  data-table/{list-search-params.ts, list-search.tsx, saved-views-menu.tsx}
  travel/
    bulk-actions.tsx  owner-cell.tsx   — copia de apps/app/components/crm
    fields/fields-entity.ts            — CUSTOMER/TRAVELER/QUOTE/BOOKING/SUPPLIER
    record-sheet/{record-stack,record-prefetch,record-sheet-host,customer-sheet}
```

### Decisiones de 3A

- **Rutas y textos en inglés.** El plan_01 los tenía en español; se cambió.
  `@travel/auth/src/auth.ts` tuvo que pasar de `/aceptar/` a `/accept/`.
- **`record-stack.ts` se copió, no se promovió.** Fija los 5 tipos de registro de
  viajes. Se promueve después, cuando ambos productos coincidan.
- **`entity-logo.tsx` no se usa.** Es el único archivo de `@crm/ui` que importa
  `@crm/db`. La ficha usa `Avatar` + `initialsFromName`. `@crm/db` queda fuera
  del grafo del navegador.
- **Campos personalizados diferidos.** `customers-table` usa `SavedViewsMenu` pero
  no columnas ni facetas de campos. El subsistema `fields/*` llega en 3B/3C.
- **La ficha de cliente es de lectura + ciclo de archivo.** Sin edición en línea
  en 3A.
- **Montos en la interfaz.** `formatAmount` nuevo en `@crm/ui`. Los montos de
  viajes son `number` en unidades mayores; `formatMoney` divide entre 100.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — 14/14 (1 warning de barrel en `postcss.config.mjs`, igual que
  `apps/app`).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-app build` — pasa. Sin `Module not found: dns`. La
  frontera cliente/servidor está limpia.
- `bun run --filter=travel-api test` — 158 casos, sin cambios.

### Comandos

```sh
docker compose up -d
bun install
bun run dev                 # crm 3000/3001, agent 2000, travel 3010/3011
open localhost:3010
```

`TRAVEL_BETTER_AUTH_SECRET` debe estar en `.env`. Sin él, better-auth usa un
secreto por defecto y lanza en `next build`.

### Pendiente de 3A

- Recorrido manual con dos cuentas en dos agencias. El paso clave: desde la
  segunda cuenta, pegar `?record=customer:<id ajeno>` debe decir "no encontrado".
- El `next dev` real no se ejecutó en esta sesión. `build` y `check-types` sí.

---

## Fase 3B — HECHO — el resto de las entidades

Cinco entidades sobre el andamiaje de 3A. Rutas y textos en inglés.

### Archivos nuevos — `apps/travel-app`

```
app/(app)/[agency]/
  suppliers/   page + search-params + table + bulk-actions + create-sheet
  suppliers/[supplierId]/page.tsx        redirige a ?record=supplier:<id>
  travelers/   page + search-params + table + bulk-actions + create-sheet
  travelers/[travelerId]/page.tsx        redirige a ?record=traveler:<id>
  quotes/      page + search-params + table + bulk-actions + create-sheet
  quotes/[quoteId]/page.tsx              redirige a ?record=quote:<id>
  bookings/    page + search-params + table + bulk-actions + create-sheet
  bookings/[bookingId]/page.tsx          redirige a ?record=booking:<id>
  payments/    page + payments-screen.tsx   (filtros kind + status, sin ficha)

components/travel/
  supplier-kind.ts  document-type.ts  status-labels.ts
  record-sheet/{supplier-sheet, traveler-sheet, quote-sheet, booking-sheet}.tsx
  itinerary/
    types.ts          ItineraryDraft, emptyDetails() por rama, draftFromOutput()
    details-fields.tsx despacho de 9 ramas (FLIGHT…OTHER)
    items-editor.tsx   arreglo controlado de renglones
  quotes/options-editor.tsx    arreglo de opciones, cada una con items-editor
  bookings/travelers-editor.tsx   pasajeros en línea (crea filas Traveler)
  payments/
    payment-meta.ts   métodos, estados, variante de badge
    payment-dialogs.tsx   AddPaymentDialog, AddPayableDialog
    payments-panel.tsx    lista + record/void/remove, gate canRecordPayment

lib/date-input.ts   dateInputToIso(), isoToDateInput()
```

`record-sheet-host.tsx` ahora despacha los 5 tipos de ficha.

### Editores que reemplazan el conjunto

- **Itinerario** (`bookings.setItems`) y **opciones** (`quotes.setOptions`) guardan
  un borrador local del arreglo y envían todo. `SaveBar` de `@crm/ui` es el
  control. El borrador lleva una llave de cliente que se quita antes de enviar.
- **`item.details`** se lee con `readItineraryDetails` de
  `@travel/validation/itinerary-item`. Un renglón ilegible degrada a
  `UNREADABLE_DETAILS`, no tumba la lista.
- **Pasajeros de una reserva** (`bookings.setTravelers`) crea filas `Traveler` en
  línea. No es un selector sobre pasajeros existentes.
- El editor de opciones exige una opción como mínimo; el editor de pasajeros y el
  de itinerario aceptan cero filas.

### Decisiones de 3B

- **`quote.accept`** abre la ficha de la reserva nueva con
  `openRecord({ kind: "booking", id })`.
- **Estado editable en línea** en las fichas de cotización y reserva vía un
  `Select` que llama `quotes.update` / `bookings.update`. El resto de la ficha es
  de lectura.
- **`OVERDUE`** no se calcula en la interfaz. El filtro de la pantalla de pagos
  manda el valor derivado y el API lo entiende.
- **`canRecordPayment`** (admin o contable) esconde los botones de mutación de
  pagos. Se lee de `trpc.users.me`.
- **`payments.add` / `addPayable`** solo desde la ficha de la reserva, donde el
  `bookingId` está en contexto. La pantalla global de pagos es lista +
  record/void/remove.
- **Campos personalizados** siguen diferidos a 3C. Las tablas usan
  `SavedViewsMenu` pero no columnas ni facetas de campos.
- **`marginBase`** se muestra tal como lo devuelve el API. `bookings.list` y
  `bookings.byId` aún lo mandan a todo rol; 3C.1 lo corrige en el servidor.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — 14/14 (3 warnings de barrel preexistentes: `lib/roles.ts`,
  `postcss.config.mjs`).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-app build` — pasa. 12 rutas del área `[agency]`
  prerenderizan. Sin `Module not found: dns`. Frontera cliente/servidor limpia.
- `bun run --filter=travel-api test` — 158 casos, sin cambios (3B no toca la API).

### Pendiente de 3B

- El `next dev` real no se ejecutó. `build` y `check-types` sí.
- Recorrido manual: dos pasajeros, cotización con dos opciones, aceptar, folio
  consecutivo, anticipo + parcialidades, margen en moneda base, `OVERDUE` al
  poner una fecha en el pasado, total que declara el faltante.
- `record` de un pago usa `paidAt = ahora` sin diálogo de método/referencia.
- El itinerario no lee `startLocation` / `endLocation` de la respuesta
  (`bookingItemOutput` no los expone); el editor los manda pero arrancan en
  `null` al releer.

---

## Fase 3C — HECHO — tablero y ajustes

Módulo `dashboard` nuevo en `apps/travel-api`, el tablero y las cinco pantallas
de ajustes en `apps/travel-app`. Rutas y textos en inglés.

### Archivos nuevos — `apps/travel-api`

```
src/dashboard/
  dashboard.module.ts     imports [TrpcModule, CurrencyModule]
  dashboard.contracts.ts  dashboardSummaryInput ({ scope }), dashboardSummaryOutput
  dashboard.router.ts     @UseMiddlewares(AuthMiddleware, AgencyMiddleware)
  dashboard.service.ts    agregación pura, sin inteligencia
test/dashboard.spec.ts    4 casos: sumas del mes, marginBase null para agent,
                          vencidos, salidas dentro de 30 días
```

`dashboard.summary({ scope: "me" | "everyone" })` devuelve, todo en moneda base:

| Campo | Origen |
| --- | --- |
| `month.soldBase` | `_sum` de `Booking.sellTotalBase` del mes en curso (por `createdAt`) |
| `month.costBase` | `_sum` de `Booking.costTotalBase` del mes en curso |
| `month.marginBase` | `soldBase − costBase`. **`null` si `canSeeMargins` es falso** |
| `month.bookings` | conteo de reservas del mes, sin `CANCELLED` ni archivadas |
| `overdue` | `Payment` con `status = SCHEDULED AND dueDate < now()`: suma, conteo y `missingRate` |
| `departures` | `Booking` con `travelStartDate` en los próximos 30 días: conteo + hasta 8 filas |
| `unconverted` | `ConversionService.unconverted()` — conteo y monedas sin tasa |

`scope = "me"` filtra reservas por `ownerId` y vencidos por `booking.ownerId`.

### Cambios fuera de `apps/travel-api/src/dashboard`

| Archivo | Cambio |
| --- | --- |
| `src/app.module.ts` | `+ DashboardModule` |
| `src/generated/server.ts` | regenerado, 13 routers, 105 procedimientos |
| `test/agency-id-inputs.spec.ts` | `+ dashboardContracts` en la lista |

### Archivos nuevos — `apps/travel-app`

```
app/(app)/[agency]/
  page.tsx                       tablero (reemplaza el marcador de posición)
  overview-search-params.ts      parser de scope (nuqs/server)
  overview-scope.tsx             ToggleGroup Me / Everyone
  dashboard-summary.tsx          StatGroup + DashboardRow, salidas y vencidos
  settings/
    layout.tsx  settings-sidebar.tsx   General / Members / Currencies /
                                       Custom fields / Folios
    page.tsx  agency-profile-form.tsx        agency.profile / updateProfile
    members/page.tsx  members-screen.tsx     members, setRole, removeMember,
                                             invitations, invite, revokeInvitation
    currencies/page.tsx  currency-settings.tsx   currency.settings + mutaciones
    folios/page.tsx  folios-form.tsx           updateProfile con quote/bookingPrefix
    fields/page.tsx  fields-screen.tsx  fields-manager.tsx  field-editor-sheet.tsx
```

### Decisiones de 3C

- **El tablero es agregación, no inteligencia.** Sin cliente de proveedor, sin
  puntuación. Respeta la regla de `AGENTS.md`.
- **`marginBase` se anula en el servidor.** El servicio del tablero devuelve
  `null` cuando `canSeeMargins` es falso. `bookings.list` y `bookings.byId`
  todavía mandan el margen a todo rol; sigue pendiente (ver Issues).
- **La interfaz muestra el faltante, nunca lo trata como cero.**
  `unconverted.count` y `overdue.missingRate` se declaran junto al total.
- **`agency.invite` con `delivered: false`** muestra el enlace copiable. No es un
  error, es el caso sin `TRAVEL_RESEND_API_KEY`.
- **`canManage` sale de `agency.profile`.** Las cinco pantallas de ajustes lo
  leen de una sola fuente y esconden los controles de escritura.
- **`settings/fields`** usa `@travel/db/fields-shape` (módulo hoja, sin Prisma) en
  el cliente, nunca `@travel/db/fields`. Selector de entidad en la URL (`?entity`),
  reordenar con `SortableList`, editor en un `Sheet`.
- **`record-stack.ts`** no tenía `timelineTabParser`. `SEARCH_PARAM` de viajes no
  tenía la llave `timeline`. La Fase 5B agrega la llave `record.timeline` y la
  limpia en `write()`.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — 14/14 (warnings de barrel preexistentes).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-api test` — 164 casos (158 + 4 `dashboard.spec` + 2
  del check de `agencyId`).
- `bun run --filter=travel-app build` — pasa. Las 6 rutas nuevas prerenderizan.
  Sin `Module not found: dns`. Frontera cliente/servidor limpia.

### Pendiente de 3C

- El `next dev` real no se ejecutó. `build`, `check-types` y `test` sí.
- Recorrido manual: tablero con ventas del mes, margen, vencidos y salidas; rol
  `agent` sin margen y con `marginBase: null` en la respuesta; cambiar la moneda
  base sin re-tasar lo ya convertido.
- `bookings`/`quotes` todavía devuelven `marginBase` a todo rol en la red.

---

## Fase 4A — HECHO — modelo `Commission` y módulo API

Plan: `docs/travel/plan_04.md`. Alcance: **solo comisiones**. Tareas, documento
de cotización y `apps/travel-agent` quedan fuera. 4B (la app) es pendiente.

### Problema

La agencia sabe cuánto vendió y cuánto ganó. No sabía cuánto le debe a cada
asesor. Ahora existe la fila que congela la comisión y los reportes que la suman.

### Archivos

```
packages/travel-db/prisma/schema.prisma       enums CommissionBasis/CommissionStatus, modelo Commission
packages/travel-db/prisma/migrations/20260903224327_commission/
packages/travel-db/src/tenancy.ts             + "Commission" en TENANT_MODELS
packages/travel-db/prisma/seed.ts             2 comisiones por agencia sembrada; AgencySettings gana los defaults
packages/travel-db/test/tenancy.spec.ts       + caso de aislamiento de commission (12 casos)
packages/travel-auth/src/agency.ts            + canManageCommission (admin o contable)
packages/travel-auth/src/index.ts             exporta el predicado
packages/travel-auth/README.md               aviso del generador incluye las relaciones de comisión
apps/travel-api/src/commissions/              module + router + service + contracts
apps/travel-api/src/app.module.ts             + CommissionsModule
apps/travel-api/src/generated/server.ts       regenerado: 14 routers, 118 procedimientos
apps/travel-api/test/commissions.spec.ts      8 casos
apps/travel-api/test/{helpers,agency-id-inputs,tenancy}.spec.ts   ajustes
```

### Decisiones

- **`basisBaseAmount` y `amountBase` se congelan al crear.** `MARGIN` y `SELL`
  nacen en moneda base, sin `fxRate`. `FIXED` pasa por
  `ConversionService.itemFields()`. Solo `amountBase` se suma. Tasa faltante es
  `null`; `list` y `byAdvisor` devuelven `missingRate`. Nunca cero.
- **`recalculate` es la única vía para mover el monto.** Relee los totales de la
  reserva y re-congela. Lanza si la comisión está `PAID` o `VOID`.
- **`AgencySettings`** gana `defaultCommissionBasis` y `defaultCommissionRate`.
  Son los valores por defecto del formulario de 4B, no una regla que corre sola.
- **`canManageCommission` (admin o contable)** guarda `create`, `update`,
  `approve`, `markPaid`, `void`, `remove`, `recalculate`, y ambos bulk.
- **Un `agent` ve solo sus filas** en `list` y en `byAdvisor`. El filtro
  `userId` lo pone el servicio, nunca es un input. `bySupplier` exige
  `canSeeMargins`.
- **Cierra el pendiente de 3C:** `bookings.list`, `bookings.byId` y
  `quotes.byId` reciben `role` y anulan `sellTotalBase`, `costTotalBase` y
  `marginBase` sin `canSeeMargins`. `setItems`, `setTravelers` y `setOptions`
  pasan el `role` a `byId`.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — pasa. `bun run lint:slop` — pasa.
- `bun run --filter=@travel/db test` — 12 casos, contra Postgres 5433.
- `bun run --filter=travel-api test` — 186 casos.
- Arranque real: `/health` responde `up`; `/openapi.json` expone las 12 rutas
  `/commissions/*`.

### Pendiente de 4A

- RESUELTO en la Fase 9 — La base `travel` local ya se resiembra con
  `bun run travel:seed`, que ahora borra y vuelve a sembrar sin `migrate reset`.
- Recorrido manual con dos cuentas: crear una comisión `MARGIN`, verificar el
  congelado, `recalculate`, una `FIXED` en otra moneda, y que un `agent` no vea
  el margen de la reserva.

---

## Fase 4B — HECHO — comisiones en `apps/travel-app`

Plan: `docs/travel/plan_04.md`, rebanada 4B. La interfaz de comisiones sobre el
módulo API de 4A. Rutas y textos en inglés, como 3A a 3C.

### Problema

La API sabía cuánto debe la agencia a cada asesor. La app no lo mostraba. Un
asesor no podía crear ni ver una comisión desde el navegador.

### Cambio en la API

`agency.updateProfile` y `agency.profile` no exponían los defaults de comisión de
`AgencySettings`. Ahora sí, para que la pantalla de ajustes los escriba.

| Archivo | Cambio |
| --- | --- |
| `apps/travel-api/src/agency/agency.contracts.ts` | `+ defaultCommissionBasis` y `+ defaultCommissionRate` en `agencyProfileOutput` y `updateAgencyProfileInput` |
| `apps/travel-api/src/agency/agency.service.ts` | `profile()` devuelve ambos; `updateProfile()` los escribe. `Decimal` entra, `number` sale |
| `apps/travel-api/src/generated/server.ts` | regenerado: 14 routers, 118 procedimientos |

`updateProfile` sigue con la guarda `canManageAgency` (owner o admin). Un
contable gestiona comisiones sueltas pero no los defaults de la agencia.

### Archivos nuevos — `apps/travel-app`

```
app/(app)/[agency]/commissions/
  page.tsx                       servidor, prefetch + HydrateClient
  commissions-search-params.ts   createListSearchParams, facetas status y basis; quita fields/archived
  commissions-table.tsx          cliente, COLUMNS + useTableQuery; el clic abre la reserva en pestaña commissions
  commissions-bulk-actions.tsx   aprobar y marcar pagado en lote
  create-commission-sheet.tsx    Sheet por ?new=true; picker de reserva y de asesor
  reports/page.tsx               servidor, prefetch byAdvisor
  reports/commissions-reports.tsx   dos SimpleTable en un DashboardRow; by supplier exige canSeeMargins

app/(app)/[agency]/settings/commissions/
  page.tsx  commissions-form.tsx   defaults por agency.updateProfile

components/travel/commissions/
  commission-meta.ts             COMMISSION_STATUSES, COMMISSION_BASES, labels, variante de badge
  commission-dialogs.tsx         AddCommissionDialog, con bookingId fijo
  commissions-panel.tsx          panel compartido; página y pestaña de booking-sheet
  commissions-links.tsx          ReportsLink y BackToListLink, cada uno en su Suspense
```

### Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `apps/travel-app/lib/roles.ts` | `+ canManageCommission` en el re-export de `@travel/auth/agency` |
| `apps/travel-app/components/travel/record-sheet/booking-sheet.tsx` | pestaña `commissions` con `CommissionsPanel`; `canManageCommission(me.role)` |
| `apps/travel-app/components/app-icon-rail.tsx` | `+ { title: "Commissions", href: "/commissions", icon: Wallet }` entre Payments y Settings |
| `apps/travel-app/proxy.ts` | `+ "/commissions"` en `SECTIONS` |
| `apps/travel-app/lib/trpc/cache.ts` | `+ commission(bookingId?)`; `booking()` invalida `commissions.list`, `byBooking` y `byAdvisor` |
| `apps/travel-app/app/(app)/[agency]/settings/settings-sidebar.tsx` | `+ { title: "Commissions", href: "/settings/commissions" }` |
| `apps/travel-app/app/(app)/[agency]/page.tsx` | prefetch de `commissions.byAdvisor` |
| `apps/travel-app/app/(app)/[agency]/dashboard-summary.tsx` | tarjeta "Top advisors" en un `DashboardRow` nuevo |

### Decisiones de 4B

- **La comisión no es un `RecordKind`.** La tabla no abre ficha propia. El clic
  abre la ficha de la **reserva** con `openRecord({ kind: "booking", id })` y
  `setTab("commissions")`. Sin cambio en `record-stack.ts` ni en `BY_ID`.
- **`commissions.list` no tiene `fields` ni `archived`.** `toCommissionListInput`
  los quita del resultado de `toInput`. Sin `SavedViewsMenu` ni botón de
  archivado: comisiones no tiene `FieldEntity` ni estado archivado.
- **El botón y el 403 leen el mismo predicado.** `canManageCommission` de
  `@travel/auth/agency` esconde crear, aprobar, pagar, recalcular, anular y
  borrar. Un `agent` ve solo sus filas y ningún control de escritura.
- **La creación desde la ficha de la reserva** usa `AddCommissionDialog` con el
  `bookingId` en contexto. La lista usa el `Sheet` con picker de reserva.
- **El reporte by supplier** solo carga si `canSeeMargins`; para un `agent` la
  tarjeta dice "Not available for your role", no lanza.
- **La tarjeta "Top advisors"** ordena por comisión y muestra hasta 6 filas.
  `StatGroup` se queda con cuatro `StatCard`.
- **Tasa faltante declarada, nunca cero.** La lista y el panel cuentan las filas
  sin `amountBase` junto al total.
- **`ReportsLink` y `BackToListLink`** usan `useAgencyUrl` (hook de cliente
  dinámico); cada uno va en su propio `<Suspense>` para no romper el prerender.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — 14/14 (warnings de barrel preexistentes: `lib/roles.ts`,
  `postcss.config.mjs`).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-app build` — pasa. Las 3 rutas nuevas prerenderizan.
  Sin `Module not found: dns`. Frontera cliente/servidor limpia.
- `bun run --filter=travel-api test` — 186 casos, sin cambios (4B no toca la
  lógica del servicio; el cambio de `agency` no rompe ninguna prueba).

### Pendiente de 4B

- El `next dev` real no se ejecutó. `build`, `check-types`, `lint` y `test` sí.
- RESUELTO en la Fase 9 — `bun run travel:seed` resiembra la base local.
- Recorrido manual con dos cuentas: crear una comisión `MARGIN` desde la ficha de
  la reserva, verificar el congelado, `recalculate`, una `FIXED` en otra moneda,
  quitar una tasa y ver el faltante declarado, entrar con un `agent` y ver solo
  sus filas sin botones, y pegar la URL de una comisión ajena desde la segunda
  agencia.
- El picker de reserva de `create-commission-sheet.tsx` lista las 50 reservas más
  recientes. Sin búsqueda: no hay `bookings.options`. La vía principal de
  creación es el panel de la ficha de la reserva.

### Riesgos abiertos de comisiones

- El monto congelado se desincroniza si cambia el itinerario. `recalculate` es
  manual. La interfaz aún no marca la fila desincronizada.
- `ExchangeRate` global: una comisión `FIXED` en otra moneda usa una tasa que
  otra agencia sobrescribe con `MANUAL`.
- Sin tasa por asesor (`AgencySettings` guarda una sola por agencia). Sin
  creación automática al confirmar. `markPaid` no escribe una fila de egreso.

---

## Fase 5A — HECHO — datos y API de tareas y recordatorios

Plan: `docs/travel/plan_07.md`, rebanada 5A. Alcance: **solo tareas y
recordatorios**. El documento de cotización y `apps/travel-agent` quedan fuera.
Cada uno necesita su plan.

### Problema

El módulo `activities` existía y funcionaba. Nadie lo veía. `activities.myTasks`
filtraba por `createdById`, así que "mis tareas" eran "las que yo escribí". Una
agencia con cuatro asesores no repartía pendientes.

### Archivos

```
packages/travel-db/prisma/schema.prisma            + assignedToId, reminderSentAt, sourceKey; @@unique([agencyId, sourceKey]); índices nuevos
packages/travel-db/prisma/migrations/20260904120000_activity_assignee_and_reminders/
                                                   ALTER TABLE + UPDATE de respaldo (createdById → assignedToId en TASK)
packages/travel-db/prisma/seed.ts                  + dos tareas por agencia, una vencida y una futura, asignadas al owner

apps/travel-api/src/activities/activities.contracts.ts   + taskListInput/Output, assignInput, updateTaskInput, removeInput, completeManyInput; activityEntryOutput gana assignedTo, reminderSentAt, sourceKey
apps/travel-api/src/activities/activities.service.ts     myTasks → tasks(agencyId, role, viewerId, input); + assign, updateTask, remove, completeMany; complete gana guarda
apps/travel-api/src/activities/activities.router.ts      myTasks → tasks (POST /activities/tasks/search); + assign, updateTask, remove, completeMany
apps/travel-api/src/activities/reminders-config.ts       REMINDERS as const
apps/travel-api/src/activities/reminders.service.ts      sweepAllAgencies(): tarea vencida, pago vencido, salida próxima
apps/travel-api/src/activities/reminders.controller.ts   GET|POST /internal/sync/reminders, copia rates.controller.ts
apps/travel-api/src/activities/reminder-mailer.ts        sendReminderEmail(): Resend opcional, falla abierto
apps/travel-api/src/activities/activities.module.ts      + RemindersController, + RemindersService
apps/travel-api/src/dashboard/dashboard.service.ts       + tasks: { open, overdue }; scope "me" filtra por assignedToId
apps/travel-api/src/dashboard/dashboard.contracts.ts     + tasks en la salida
apps/travel-api/src/config/env.validation.ts             + TRAVEL_REMINDER_FROM
apps/travel-api/vercel.json                              + reminders (0 8 * * *); quita los 4 crons muertos
apps/travel-api/test/activities.spec.ts                  nuevo — alcance por rol, asignación, ventanas, guarda de complete
apps/travel-api/test/reminders.spec.ts                   nuevo — aislamiento por agencia, idempotencia, 503/403, sin Resend, ventana de re-aviso
.env.example, turbo.json, apps/travel-api/turbo.json     + TRAVEL_REMINDER_FROM
```

### Decisiones

- **`assignedToId` es columna, no `meta`.** Un filtro y un índice la necesitan.
- **El asignado por defecto es el autor.** La migración copia `createdById` a las
  filas `TASK` existentes con un `UPDATE` a mano.
- **`agent` ve solo lo asignado a él.** `canSeeMargins` separa "ve todo" de "ve
  lo suyo", lo pone el servicio, nunca es input. Sin predicado nuevo.
- **`complete`, `assign`, `updateTask`, `remove`** exigen el asignado o
  `canSeeMargins`. Antes cualquier miembro cerraba cualquier tarea.
- **La colisión de `upcoming` se parte.** El timeline conserva `upcoming` = tarea
  abierta. La bandeja usa `window: overdue | today | week | all` derivado de
  `dueAt`. Dos vistas, dos vocabularios.
- **El barrido escribe filas `Activity`, no un modelo nuevo.** La idempotencia es
  `@@unique([agencyId, sourceKey])` + `createMany({ skipDuplicates: true })`, no
  un `SELECT` previo. Una tarea humana tiene `sourceKey` nulo y no choca.
- **El endpoint falla cerrado. El correo falla abierto.** Sin `TRAVEL_CRON_SECRET`
  el barrido responde 503. Sin `TRAVEL_RESEND_API_KEY`/`TRAVEL_REMINDER_FROM`
  escribe y estampa, y no manda correo.
- **La migración se hizo con `prisma migrate diff` + `migrate deploy`**, no con
  `migrate dev` (no corre sin TTY). `travel:auth:generate` no se corrió.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — pasa (warnings de barrel preexistentes).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-api test` — 203 casos (186 + 17 nuevos).
- `curl -X POST /internal/sync/reminders` sin auth → 403; con auth correcto →
  `{ agencies, reminded, created, ... }`; segunda corrida → `reminded: 0`.
- Swagger muestra `/internal/sync/reminders` en el documento OpenAPI.

### Pendiente de 5A

- RESUELTO en la Fase 9 — `bun run travel:seed` ahora es idempotente (borra y
  siembra) y siembra tareas en cada ventana de la bandeja.
- El `curl` sin secreto responde 403, no 503, porque `TRAVEL_CRON_SECRET` ya está
  en el `.env` local. El caso 503 lo cubre la prueba unitaria del controlador.

## Fase 5B — HECHO — timeline, bandeja de tareas y tarjeta del tablero

Plan: `docs/travel/plan_07.md`, rebanada 5B. Rutas y textos en inglés, como 3A a
4B.

### Archivos nuevos — `apps/travel-app`

```
components/travel/timeline/
  timeline.tsx                 portado de apps/app; ancla { customerId } | { quoteId } | { bookingId }; pestañas all|notes|upcoming|done
  timeline-entry.tsx           sin ramas de correo/calendario/deal/contact; + nombre del asignado
  activity-composer.tsx        + selector de asesor cuando el tipo es TASK; tipos NOTE|CALL|TASK
  activity-icon.tsx            usa la presentación de viajes
  timeline-search-params.ts    TIMELINE_TABS = all|notes|upcoming|done
components/travel/activity-presentation.ts    activityLabel/activityIcon sobre el ActivityType de viajes (con SYSTEM)
lib/use-hydrated.ts            copia de apps/app

app/(app)/[agency]/tasks/
  page.tsx                     servidor, requireSession + prefetch + HydrateClient
  tasks-search-params.ts       createListSearchParams({ tabId: "window", facetIds: ["assignedTo"] })
  tasks-table.tsx              cliente, COLUMNS + useTableQuery; el clic abre la ficha del ancla en pestaña timeline
  tasks-bulk-actions.tsx       activities.completeMany
  create-task-sheet.tsx        Sheet por ?new=true; selector de ancla (customer/quote/booking) y de asesor
```

### Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `components/travel/record-sheet/booking-sheet.tsx` | + pestaña `timeline` con `<Timeline anchor={{ bookingId }} />` |
| `components/travel/record-sheet/quote-sheet.tsx` | + pestaña `timeline` con `<Timeline anchor={{ quoteId }} />` |
| `components/travel/record-sheet/customer-sheet.tsx` | pasa de `DetailSheetBody` plano a `DetailSheetTabs` con `overview` y `timeline` |
| `components/travel/record-sheet/record-stack.ts` | + `record.timeline` en `params`, y se limpia en `write()` |
| `lib/search-param-keys.ts` | + `record.timeline: "timeline"` |
| `lib/trpc/cache.ts` | `activityKeys()`: `myTasks` → `tasks`; `activity()` invalida `dashboard.summary` |
| `components/app-icon-rail.tsx` | + `{ title: "Tasks", href: "/tasks", icon: Task }` entre Commissions y Settings |
| `proxy.ts` | + `/tasks` en `SECTIONS` |
| `components/travel/status-labels.ts` | + `TASK_WINDOWS` y `taskWindowLabel` |
| `app/(app)/[agency]/dashboard-summary.tsx` | + tarjeta "My tasks" con `open` y `overdue` de `dashboard.summary().tasks` |

### Decisiones de 5B

- **La tarea no es un `RecordKind`.** La tabla no abre ficha propia. El clic abre
  la ficha del ancla (`openRecord({ kind, id })` + `setTab("timeline")`), como la
  tabla de comisiones abre la reserva.
- **El timeline no enlaza.** Se quita `RecordLink` al portar; una entrada del
  timeline no navega a nada.
- **`window` es `tabId`, no faceta.** `createListSearchParams` da un parámetro
  escalar con default `"all"`; `assignedTo` sí es faceta.
- **Sin correo ni calendario.** El modelo de viajes no tiene `emailThread` ni
  `calendarEvent`, así que `email-thread-entry.tsx` y `meeting-entry.tsx` no se
  portan y el composer no ofrece EMAIL ni MEETING.

### Verificado

- `bun run check-types` — 22/22 (`next typegen` para la ruta `/tasks` nueva).
- `bun run lint` — pasa. `bun run lint:slop` — pasa.
- `bun run --filter=travel-api test` — 203 casos.

### Pendiente de 5B

- El `next dev` real no se ejecutó. `check-types`, `lint`, `lint:slop` y las
  pruebas de la API sí.
- Recorrido manual con dos cuentas en dos agencias, según `plan_07.md`.

### Riesgos abiertos de la Fase 5

- El barrido no toma un lease. Dos instancias en paralelo mandan el correo dos
  veces. Las filas no se duplican por la restricción única.
- El barrido recorre todas las agencias en una petición. `maxAgenciesPerRun` la
  acota; un cursor entre corridas queda pendiente.
- RESUELTO — Sin recordatorio de documento por vencer. La Fase 7A lo cierra
  con `Traveler.documentExpiresAt`, que ya tenía índice.
- "Salida próxima" no re-avisa si la fecha de salida cambia: el `sourceKey` es
  por reserva.
- La tabla de tareas muestra "Booking"/"Quote"/"Customer" como ancla, no el
  folio ni el nombre. `activityEntryOutput` no trae esas etiquetas.

---

## Fase 6A — HECHO — modelo `QuoteShare` y routers `quoteShare`/`publicQuote`

Plan: `docs/travel/plan_08.md`, rebanada 6A. Alcance: **solo el documento de
cotización**. `apps/travel-agent` queda fuera y necesita su propio plan.

### Problema

El asesor arma una cotización con dos o tres opciones y no tenía cómo
mostrarla al cliente. La cotización vivía dentro de la app, detrás de la
sesión. El cliente no la veía, no la imprimía y no la aceptaba.

### Archivos

```
packages/travel-db/prisma/schema.prisma         modelo QuoteShare, + acceptedOptionId/acceptedByName en Quote
packages/travel-db/prisma/migrations/20260904150000_quote_share/
packages/travel-db/src/tenancy.ts               + "QuoteShare" en TENANT_MODELS
packages/travel-db/prisma/seed.ts               1 QuoteShare por agencia sembrada
packages/travel-db/test/tenancy.spec.ts         + caso de aislamiento de quoteShare (13 casos)
packages/travel-auth/README.md                  aviso del generador incluye la relación de QuoteShare
apps/travel-api/src/quote-share/
  quote-share.contracts.ts     shareQuoteIdInput (distinto de quotes.contracts.ts's quoteIdInput)
  quote-share.service.ts       status/create/revoke/send/view/accept, resolve(token) privado
  quote-share.router.ts        alias "quoteShare" — AuthMiddleware + AgencyMiddleware
  public-quote.router.ts       alias "publicQuote" — SIN middleware, el único router público del producto
  quote-mailer.ts              TRAVEL_RESEND_API_KEY + TRAVEL_QUOTE_FROM, opcional, nunca lanza
  quote-share.module.ts
apps/travel-api/src/app.module.ts               + QuoteShareModule
apps/travel-api/src/generated/server.ts         regenerado: 16 routers, 128 procedimientos
apps/travel-api/src/config/env.validation.ts    + TRAVEL_QUOTE_FROM
apps/travel-api/test/quote-share.spec.ts        10 casos
apps/travel-api/test/{helpers,agency-id-inputs}.spec.ts   ajustes
.env.example, turbo.json, apps/travel-api/turbo.json      + TRAVEL_QUOTE_FROM
```

### Decisiones

- **`QuoteShare` es un modelo nuevo, no columnas en `Quote`.** El historial de
  enlaces (revocado, vencido, vuelto a crear) necesita sus propias filas.
- **El token nunca se guarda.** 32 bytes `base64url`, solo su `sha256` vive en
  `tokenHash`. `create` y `send` devuelven la URL una sola vez; `status` no
  puede volver a mostrarla.
- **`resolve(token)` es la segunda excepción al cliente con alcance**, junto a
  `ExchangeRate` (`docs/travel/domain.md`). Un llamador anónimo no tiene
  `agencyId` que pasar a `agencyDb`; la fila resuelta por `tokenHash` es la
  que lo da, y desde ahí todo vuelve a pasar por `agencyDb(this.db,
  share.agencyId)`.
- **`publicQuote` no lleva `@UseMiddlewares`.** Es intencional: el único router
  del producto sin `AuthMiddleware`/`AgencyMiddleware`. El contrato de salida
  (`publicQuoteOutput`) es la lista blanca — sin `cost*`, `margin*`, `ownerId`,
  `customerId` ni `userId` — y la única guarda posible, porque no hay rol que
  revisar.
- **Aceptar no crea la reserva.** `accept` fija `status: "ACCEPTED"`,
  `decidedAt`, `acceptedOptionId`, `acceptedByName`. `quotes.accept` (del
  asesor) sigue siendo quien crea el `Booking`; su guarda mira `quote.booking`,
  no `quote.status`, así que las dos rutas no chocan.
- **`accept` es idempotente sobre la misma opción.** Aceptar dos veces la
  misma opción devuelve el mismo resultado y no duplica la `Activity`.
  Aceptar una opción distinta después de `ACCEPTED`, o sobre una cotización
  vencida, lanza.
- **`view` cuenta la visita y registra una `Activity` `SYSTEM` solo en la
  primera vista** (`firstViewAt` pasa de `null` a una fecha una sola vez).
- **`send` siempre emite un token nuevo.** No existe "reenviar el mismo
  enlace": el `tokenHash` no es reversible, así que reenviar revoca el share
  vivo y crea uno.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — pasa. `bun run lint:slop` — pasa.
- `bun run --filter=@travel/db test` — 13 casos (12 + 1 de `quoteShare`).
- `bun run --filter=travel-api test` — 223 casos (213 + 10 de `quote-share.spec.ts`).
- `curl GET /rest/public/quotes/{token}` — expone `publicQuote.view` en el
  puente REST sin cookie de sesión.

### Pendiente de 6A

- RESUELTO en la Fase 9 — `bun run travel:seed` resiembra la base local y
  siembra seis `QuoteShare` con sus enlaces `/q/<token>` impresos.
- Sin límite de peticiones en `publicQuote`. Ver riesgos abiertos abajo.

---

## Fase 6B — HECHO — documento de cotización en `apps/travel-app`

Plan: `docs/travel/plan_08.md`, rebanada 6B. Rutas y textos en inglés, como
3A a 5B.

### Archivos nuevos — `apps/travel-app`

```
app/(public)/q/[token]/
  layout.tsx            importa @crm/ui/print.css. Sin header, sin rail, sin sesión
  page.tsx               servidor, instant=false, prefetch + hydrate de publicQuote.view, notFound() si falla
  quote-document.tsx      "use client", useQuery sobre la cache hidratada
  option-card.tsx          presentacional (sin hooks, sin "use client" propio)
  itinerary-lines.tsx      presentacional, lee details con readItineraryDetails
  accept-panel.tsx         "use client", elegir opción + nombre, publicQuote.accept
  print-button.tsx         "use client", window.print()

components/travel/quotes/share-panel.tsx   pestaña Share: status/create/revoke/send
```

### Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `packages/ui/src/styles/print.css` | nuevo — `@page`, `[data-print="hide"]`, tokens de tema claro forzados en impresión |
| `packages/ui/package.json` | `+ "./print.css"` en `exports` |
| `apps/travel-app/proxy.ts` | `+ "/q"` en `PUBLIC` |
| `apps/travel-app/lib/trpc/cache.ts` | `quote(id)` invalida `quoteShare.status` |
| `apps/travel-app/components/travel/record-sheet/quote-sheet.tsx` | + pestaña `share` con `<SharePanel quoteId={quoteId} />`, entre `options` y `timeline` |

### Decisiones de 6B

- **La página pública sigue el patrón de fichas ya establecido**, no el de
  "props planas" del plan original: `page.tsx` hace `fetchQuery` + `notFound()`
  en un `try/catch` (como `[agency]/layout.tsx`'s `loadAgency`) y entrega la
  cache hidratada; `quote-document.tsx` la lee con `useQuery`, igual que
  `quote-sheet.tsx` lee `quotes.byId`.
- **`export const instant = false`** en `page.tsx` es obligatorio en esta
  versión de Next: sin él, el build rechaza la ruta porque `params` y
  `fetchQuery` corren fuera de un límite `<Suspense>` en una ruta que de otro
  modo intenta prerenderizarse.
- **El panel de "Send to customer" no precarga el correo del cliente.**
  `quotes.byId` no lo expone a la ficha. El campo queda vacío con un
  placeholder; el servicio cae a `customer.email` cuando `to` es `null`.
- **El botón de imprimir usa `window.print()`, no una librería de PDF.** Cero
  dependencias nuevas, cero binario en la función serverless. El archivo que
  el cliente guarda depende de su propio navegador.

### Verificado

- `bun run check-types` — 22/22 (`next typegen` para la ruta `/q/[token]` nueva).
- `bun run lint` — pasa. `bun run lint:slop` — pasa.
- `bun run --filter=travel-app build` — pasa. La ruta `/q/[token]` prerenderiza
  parcialmente. Sin `Module not found: dns`. Frontera cliente/servidor limpia.
- `bun run --filter=travel-api test` — 223 casos, sin cambios (6B no toca la
  API).

### Pendiente de 6B

- El `next dev` real no se ejecutó. `build`, `check-types`, `lint` y
  `lint:slop` sí.
- Recorrido manual con dos cuentas en dos agencias, según `plan_08.md`.

### Riesgos abiertos de la Fase 6

- El router `publicQuote` no tiene límite de peticiones. El token de 32 bytes
  hace la prueba en serie inviable, pero un límite por IP en el proxy queda
  pendiente.
- `view` incrementa `viewCount` en cada carga anónima, incluida la de un
  robot. `robots: noindex` reduce el caso, no lo cierra.
- El cliente no puede rechazar la cotización desde el enlace, solo aceptar.
- Sin PDF de servidor: el archivo sale de la impresión del navegador del
  cliente.
- RESUELTO — El modelo `Document` sin módulo. La Fase 7 lo cierra.

---

## Fase 7A — HECHO — modelo `Document.pathname` y módulo `documents`

Plan: `docs/travel/plan_09.md`, rebanada 7A. Alcance: **solo documentos**.
`apps/travel-agent` sigue fuera y necesita su propio plan.

### Problema

El modelo `Document` existía desde la Fase 1 y nunca tuvo módulo. Subir un
voucher, un boleto o un pasaporte no existía.

### Archivos

```
packages/travel-db/prisma/schema.prisma            + Document.pathname, + Document.updatedAt,
                                                     @@unique([agencyId, pathname])
packages/travel-db/prisma/migrations/20260904164349_document_pathname/
packages/travel-db/test/tenancy.spec.ts             + caso de aislamiento de document (14 casos)
apps/travel-api/src/documents/
  documents-config.ts       DOCUMENTS.upload.{maxBytes,tokenTtlMs,allowedContentTypes}, .download.urlTtlMs
  document-storage.ts       storageEnabled, createUploadToken, signedDownloadUrl, removeObject
  documents.contracts.ts    uploadTokenInput/Output, createDocumentInput, documentListInput,
                             documentEntryOutput (sin pathname ni url), downloadUrlOutput
  documents.service.ts      storage/uploadToken/create/list/downloadUrl/update/remove/removeMany
  documents.router.ts       alias "documents"
  documents.module.ts
apps/travel-api/src/app.module.ts                   + DocumentsModule
apps/travel-api/src/generated/server.ts             regenerado: 17 routers, 136 procedimientos
apps/travel-api/src/bookings/{bookings.contracts,bookings.service}.ts   + documentCount
apps/travel-api/src/travelers/{travelers.contracts,travelers.service}.ts + documentCount
apps/travel-api/src/activities/reminders-config.ts  + travelDocument: { windowDays: 30 }
apps/travel-api/src/activities/reminders.service.ts + createTravelDocumentTasks, cuarto paso del barrido
apps/travel-api/test/documents.spec.ts               nuevo — 12 casos
apps/travel-api/test/reminders.spec.ts                + 2 casos de vencimiento de documento
apps/travel-api/test/{helpers,agency-id-inputs}.spec.ts   ajustes
```

### Decisiones

- **Blobs privados.** `access: "private"` de punta a punta. La API acuña un
  token de subida acotado a un `pathname` (`generateClientTokenFromReadWriteToken`);
  el navegador sube directo. La lectura pasa por `issueSignedToken` +
  `presignUrl`, una URL de 5 minutos por petición.
- **`Document.pathname` con `@@unique([agencyId, pathname])`.** El prefijo
  `agencies/<agencyId>/…` es la segunda barrera: un token acuñado para una
  agencia no firma la ruta de otra, y `create` verifica el prefijo antes de
  escribir.
- **Sin token de blob, la capacidad se retira, no hay excepción global.**
  `uploadToken` responde 503; `list`, `byId` y `remove` siguen funcionando.
- **Borrado duro.** `del(pathname)` primero, la fila después. Un fallo al
  borrar del almacén se registra y no bloquea el borrado de la fila.
- **Cualquier miembro sube.** Un `agent` lee solo lo anclado a sus reservas y
  a los pasajeros de esas reservas — el mismo `OR` de alcance de `activities`
  y `commissions`, puesto por el servicio. Borrar exige el que subió o
  `canSeeMargins`; renombrar no, cualquiera que vea la fila puede.
- **El recordatorio de vencimiento usa `Traveler.documentExpiresAt`,** que ya
  existía con índice. `Document` no gana fecha de vencimiento. `sourceKey`
  lleva la fecha de vencimiento para que un pasaporte renovado vuelva a
  avisar — corrige el defecto que `departure:<bookingId>` ya tenía.

### Verificado

- `bun run check-types` — 22/22.
- `bun run lint` — pasa. `bun run lint:slop` — pasa.
- `bun run --filter=@travel/db test` — 14 casos.
- `bun run --filter=travel-api test` — 250 casos (223 + 27 nuevos).

### Pendiente de 7A

- RESUELTO en la Fase 9 — `bun run travel:seed` resiembra la base local y
  siembra filas `Document` en cada `DocumentKind`.
- Sin límite de peticiones en `uploadToken`. Un miembro válido acuña tokens
  sin tope.
- El almacén no verifica el contenido del archivo, solo tipo declarado y
  tamaño.

---

## Fase 7B — HECHO — documentos en `apps/travel-app`

Plan: `docs/travel/plan_09.md`, rebanada 7B. Rutas y textos en inglés, como
3A a 6B.

### Archivos nuevos — `apps/travel-app`

```
components/travel/documents/
  document-meta.ts              DocumentAnchor, DOCUMENT_KINDS, documentKindLabel, formatBytes
  documents-panel.tsx            lista + descargar + renombrar + borrar; pestaña de reserva y pasajero
  upload-document-dialog.tsx     el flujo de tres pasos, ancla fija
  document-download.tsx          useDownloadDocument() — fetchQuery + window.open

app/(app)/[agency]/documents/
  page.tsx  documents-search-params.ts  documents-table.tsx  documents-bulk-actions.tsx
  upload-document-sheet.tsx      selector de tipo de ancla (booking/traveler) + selector del registro
```

### Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `apps/travel-app/package.json` | `+ @vercel/blob` |
| `apps/travel-app/components/travel/record-sheet/booking-sheet.tsx` | `+` pestaña `documents` entre `commissions` y `timeline` |
| `apps/travel-app/components/travel/record-sheet/traveler-sheet.tsx` | pasa de `DetailSheetBody` plano a `DetailSheetTabs` con `overview` y `documents` |
| `apps/travel-app/lib/trpc/cache.ts` | `+ document(anchor?)`; `booking()` y `traveler()` invalidan `documents.list` |
| `apps/travel-app/components/app-icon-rail.tsx` | `+ { title: "Documents", href: "/documents", icon: DocumentAttachment }` entre Tasks y Settings |
| `apps/travel-app/proxy.ts` | `+ "/documents"` en `SECTIONS` |

### Decisiones de 7B

- **`put()`, no `upload()`.** `@vercel/blob/client`'s `upload()` pide su
  propio token a una ruta `handleUploadUrl`; este producto ya tiene el token
  acuñado por la API, así que `put()` es la función correcta.
- **`DocumentsPanel` recibe `viewerId` y `canManageAll`, no un `canUpload`
  plano.** Subir es para cualquier miembro. Borrar es por fila: el botón se
  calcula `canManageAll || row.uploadedBy.id === viewerId`, para que el botón
  y el 403 del servicio nunca disientan.
- **El documento no es un `RecordKind`.** La tabla no abre ficha propia. El
  clic abre la ficha del ancla (`openRecord({ kind, id })` +
  `setTab("documents")`), como comisiones abre la reserva.
- **Sin columna de acciones en la tabla.** Descargar, renombrar y borrar viven
  en `DocumentsPanel`, dentro de la ficha.
- **La columna "On" y el selector "Attach to" muestran "Booking"/"Traveler",
  no el folio ni el nombre.** `documentEntryOutput` no trae esas etiquetas —
  el mismo límite ya aceptado en la tabla de tareas.
- **`upload-document-sheet.tsx` duplica el flujo de tres pasos** de
  `upload-document-dialog.tsx` en vez de compartirlo — la misma relación que
  ya tenían `commission-dialogs.tsx` y `create-commission-sheet.tsx`.

### Verificado

- `bun run check-types` — 22/22 (`next typegen` para la ruta `/documents` nueva).
- `bun run lint` — pasa (warnings de barrel preexistentes: `lib/roles.ts`,
  `postcss.config.mjs`).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-app build` — pasa. La ruta `/[agency]/documents`
  prerenderiza. Sin `Module not found: dns`. Frontera cliente/servidor limpia.
- `bun run --filter=travel-api test` — 250 casos, sin cambios (7B no toca la
  API).

### Pendiente de 7B

- El `next dev` real no se ejecutó. `build`, `check-types`, `lint` y
  `lint:slop` sí.
- Recorrido manual con dos cuentas en dos agencias, según `plan_09.md`.

### Riesgos abiertos de la Fase 7

- Un fallo entre subir el blob y crear la fila deja un blob huérfano. Sin
  barrido que lo detecte.
- El almacén no verifica el contenido del archivo, solo tipo declarado y
  tamaño — un `.exe` renombrado a `.pdf` entra.
- `medicalNotes`, `dietaryNotes` y `documentNumber` siguen en claro (riesgo 4
  de la Fase 1). Un pasaporte escaneado ahora vive en el almacén, cifrado en
  reposo por el proveedor, pero la fila que lo describe no lo está.
- Sin vista previa en la app — el documento se descarga, no se ve en línea.

---

## Fase 8A — HECHO — `apps/travel-agent` y el disparador

Plan: `docs/travel/plan_10.md`, rebanada 8A.

### Esquema — `packages/travel-db`

`AgentTask` (recorte de `@crm/db`'s modelo homónimo: `quoteId` en vez de
`contactId`/`companyId`/`dealId`) y `AgentConversation` (el handle de una
sesión eve — `sessionId`, `continuationToken`, `streamIndex` — nunca la
transcripción). Ambos en `TENANT_MODELS`. Migración
`20260904180000_agent_task`.

### `apps/travel-agent` — la app nueva

```
agent/
  agent.ts                  defineAgent, modelo fijo en lib/model-config.ts
  instructions.md, instructions/task.ts
  channels/travel.ts         /internal/travel/dispatch(-health), cierre de tareas
  channels/eve.ts            auth del puente (JWT HS256) + AgentConversation
  schedules/dispatch.ts      cron */10 * * * *
  tools/read_quote.ts, read_quote_share.ts, read_customer.ts, write_followup_task.ts
  lib/db.ts, tasks.ts, dispatch.ts, dispatch-config.ts, model-config.ts,
      session-context.ts, conversations.ts
  sandbox/sandbox.ts          deny-all, sin TRAVEL_DATABASE_URL en el sandbox
```

Un único tipo de tarea (`quote-followup`), sin carriles: `drainAll` reclama y
despacha una sesión eve por fila. `write_followup_task` es la única
escritura — una `Activity` `TASK` asignada al dueño de la cotización,
`sourceKey` idempotente por día.

**Diferencia de diseño frente al plan**: el plan proponía montar el puente
del navegador en `/agent/v1/*`. `useEveAgent`/`Client` de `eve/react` llaman
siempre a una ruta fija `/eve/v1/*` (`EVE_ROUTE_PREFIX` en el SDK, no
configurable) — así que el puente vive en `apps/travel-app/app/eve/v1/[...path]/route.ts`,
igual que el del CRM, y `apps/travel-app/proxy.ts` excluye `eve` de su
reescritura por agencia (como ya excluye `api`). `AgentConversation` se
escribe desde `apps/travel-agent` mismo (`instructions/task.ts` en
`session.started`, `channels/eve.ts` en `message.completed`), nunca desde un
mutation tRPC — cumple "sin `create` ni `update`" del router.

### `apps/travel-api` — el disparador

`src/agent/`: `quote-followup.service.ts` (`sweepAllAgencies`, la regla de
tres pasos del plan), `quote-followup.controller.ts`
(`GET|POST /internal/sync/quote-followups`, copia de `reminders.controller.ts`),
`bridge.ts`, `agent-dispatch.config.ts`, y el router `agentConversation`
(`list`, `latest` — de solo lectura). `vercel.json`: `0 9 * * *`.

### Variables y cableado

`TRAVEL_AGENT_URL`, `TRAVEL_AGENT_BRIDGE_SECRET`, `TRAVEL_AI_GATEWAY_API_KEY`
en `.env.example`, `turbo.json` raíz, `apps/travel-api/turbo.json`,
`apps/travel-agent/turbo.json`, `apps/travel-app/turbo.json`. `AgentModule` en
`apps/travel-api/src/app.module.ts`. `knip.json` gana la entrada
`apps/travel-agent`.

### Verificado

- `bun run check-types` — 23/23.
- `bun run lint` y `bun run lint:slop` — pasan (mismos warnings de barrel
  preexistentes).
- `bun run --filter=travel-agent build` (`eve build`) — pasa.
- `bun run --filter=@travel/db travel:test` — 16/16 (`agentTask` y
  `agentConversation` en `tenancy.spec.ts`).
- `bun run --filter=travel-api test` — 259/259 (`quote-followups.spec.ts`
  nuevo, 9 casos).
- `bun run --filter=travel-agent test` — 23/23 (`dispatch.spec.ts`,
  `channel-auth.spec.ts`, `write-followup-task.spec.ts`).

### Pendiente de 8A

- El recorrido manual con `bun run dev` y `bun run --filter=travel-agent dispatch`
  no se ejecutó en esta sesión.

## Fase 8B — HECHO — pestaña Agent en la ficha de cotización

Plan: `docs/travel/plan_10.md`, rebanada 8B.

### Archivos nuevos — `apps/travel-app`

```
app/eve/v1/[...path]/route.ts   el puente (ver nota de diseño en 8A)
lib/agent-bridge.ts              mintBridgeToken(advisorId, { agencyId, quoteId })
lib/agent/agent-session.ts       loadThread, composerState, eventsOf — sin AgentEvent
lib/agent/agent-transcript.ts    toTranscript, resolveThread — sin fuentes web
components/agent-composer-frame.ts, agent-clarification-composer.tsx
components/travel/quotes/agent-conversations.tsx   ConversationPicker, de solo lectura
components/travel/quotes/agent-panel.tsx           la pestaña
```

`packages/travel-validation` gana `eve-stream.ts` y `eve-tool.ts` — copia
recortada de `@crm/validation`'s módulos homónimos, porque `apps/travel-app`
no depende de `@crm/validation` (`docs/travel/domain.md`: comparte solo
`@crm/ui`, `@crm/env`, `@crm/typescript-config`).

### Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `apps/travel-app/components/travel/record-sheet/quote-sheet.tsx` | `+` pestaña `agent` entre `share` y `timeline` |
| `apps/travel-app/components/travel/record-sheet/record-stack.ts` | `+ record.agentThread` en `params`; `useRecordSheetView` gana `thread`/`setThread` |
| `apps/travel-app/lib/search-param-keys.ts` | `+ record.agentThread: "thread"` |
| `apps/travel-app/proxy.ts` | `eve` fuera de la reescritura por agencia (junto a `api`) |
| `apps/travel-app/lib/trpc/cache.ts` | `+ agentConversation(quoteId?)` |
| `apps/travel-app/package.json` | `+ eve` |

Sin `useSavedConversation` ni mutation `conversations.save`: la lista se
refresca (`invalidateQueries`) cuando el turno pasa de ocupado a libre, dando
tiempo a que `apps/travel-agent` escriba la fila.

### Verificado

- `bun run --filter=travel-app check-types` y `typegen` — pasan.
- `bun run --filter=travel-app build` — pasa, `/eve/v1/[...path]` dinámico,
  sin `Module not found: dns`.
- `bun run lint` / `lint:slop` — pasan.

### Pendiente de 8B

- Recorrido manual de `docs/travel/plan_10.md`'s verificación no se ejecutó.
- Sin `AgentEvent`: ver Issues de `plan_10.md`.

---

## Fase 9 — HECHO — auditoría de datos y semilla de demostración

Plan: `docs/travel/plan_11.md`. Alcance: **solo la semilla local**. Sin cambios
en el esquema, la API ni la app.

### Problema

Todo estaba construido y nada se veía funcionando. La base `travel` local tenía
11 tablas vacías, cero montos en moneda base, cero filas en `ExchangeRate` y
cada faceta con un solo valor. La semilla de la Fase 1 solo hacía `create`, así
que resembrar exigía `travel:reset` con consentimiento en una TTY. El pendiente
«la base local no se resembró» se arrastraba desde la Fase 4A.

### Cambios

```
packages/travel-db/prisma/seed.ts        orquestador: reset, rates, un ciclo por agencia
packages/travel-db/prisma/seed/          16 módulos nuevos (ver plan_11.md)
```

- **Borra y siembra.** `resetSeedData()` borra las organizaciones por slug (el
  cascade limpia el negocio), los usuarios por la lista exacta de correos, y
  `ExchangeRate` por `provider: "seed"`. Correr `travel:seed` mil veces da el
  mismo resultado. `scripts/require-local-db.ts` ya bloquea un host remoto.
- **Dos bases.** `andes-travel` en `USD`, `maya-tours` en `EUR`. `ExchangeRate`
  con las dos bases y un override `MANUAL` sobre `USD→GBP`. `JPY` se usa en
  renglones, pagos y una comisión y **no** recibe tasa, así que `unconverted()`
  cuenta y la interfaz declara el faltante.
- **Los montos base salen de `convertToBase`** de `@travel/db/fx`, la misma
  función de la API. Los totales de opción y de reserva son un espejo a mano de
  `itemBaseTotals`; el congelado de comisión, un espejo de `freeze()`. `null` si
  falta un renglón, nunca cero.
- **Fechas relativas a `now`.** Cinco reservas creadas este mes, salidas a +3,
  +9 y +28 días, pagos vencidos, un pasaporte que vence en 20 días.
- **Cinco usuarios por agencia** — `owner`, `admin`, `accountant`, 2 × `agent` —
  cada uno con contraseña `password123`, para recorrer los seis predicados de
  rol.
- **`Document` sin blob.** Filas con el prefijo `agencies/<agencyId>/…`
  correcto; solo `downloadUrl` falla sin token. `AgentTask` sembrada;
  `AgentConversation` vacía a propósito.
- **Determinista.** `makeRandom(20260905 + índice·1009)` por agencia. La corrida
  imprime los enlaces `/q/<token>` y son estables entre corridas.

### Verificado

- `bun run check-types` — 23/23.
- `bun run lint` — 15/15. `bun run lint:slop` — pasa.
- `bun run --filter=@travel/db test` — 16 casos. `bun run --filter=travel-api
  test` — 259 casos. Sin cambio.
- `bun prisma/seed.ts` dos veces — mismo resultado, ~1300 filas, ~3 s.
- Tras sembrar: `quoteItem` sin base = 2, `booking` sin total = 2, pagos
  `SCHEDULED` vencidos = 8, comisiones sin `amountBase` = 4. Todos a propósito.

### Pendiente de 9

- El `next dev` real y el recorrido con los cinco roles no se ejecutaron.
- `bun run --filter=travel-agent dispatch` con la tarea reclamable no se corrió.

---

## Fase 3 (plan original) — `apps/travel-app`

### 3.1 Cableado

- `app/layout.tsx` línea 1: `import "@crm/ui/globals.css";`
- `postcss.config.mjs`: `export { default } from "@crm/ui/postcss.config";`
- `next.config.ts`: `transpilePackages: ["@crm/ui", "@travel/auth",
  "@travel/db"]`, `serverExternalPackages: ["@prisma/client",
  "@prisma/adapter-pg", "pg"]`.
- `package.json`: `"dev": "next dev --port 3010"`.
- `components.json`: copia el de `apps/app`.

### 3.2 Rutas

```
app/(landing)/          sign-in, sign-up, crear agencia, aceptar invitación
app/(app)/[agency]/
  page.tsx              tablero
  clientes/ pasajeros/ cotizaciones/ reservas/ proveedores/ pagos/ ajustes/
```

El slug de la URL es la agencia y **sí es tenencia**. `proxy.ts` verifica
membresía antes de dejar pasar. Slug ajeno redirige.

Cada entidad repite la plantilla de 5 archivos de
`apps/app/app/(app)/[slug]/companies/`: `page.tsx` (servidor, prefetch +
hydrate), `<entidad>-search-params.ts`, `<entidad>-table.tsx` (cliente, `COLUMNS`
+ `useTableQuery`), `<entidad>-bulk-actions.tsx`, `create-<entidad>-sheet.tsx`.

### 3.3 Reutilización

- **Importar de `@crm/ui` sin tocar**: 72 primitivos, `data-table`, `card-table`,
  `dashboard`, `combobox`, `field`, `save-bar`, `sheet`, hooks y libs.
  Verificado: el único acoplamiento a `@crm/db` es `entity-logo.tsx` →
  `@crm/db/images` (módulo hoja, sin Prisma en el grafo del navegador).
- **Promover a `packages/ui` antes de Fase 3**: `list-search-params.ts`,
  `use-table-query.ts`, `record-stack.ts`, `search-param-keys.ts`.
- **Copiar al app nuevo**: `page-shell.tsx`, `detail-sheet.tsx`,
  `app-header.tsx`, `app-icon-rail.tsx`, `lib/trpc/*`, `lib/session.ts`.
- **Reescribir**: `lib/trpc/cache.ts` con fachada de dominio
  (`cache.booking(id)`, `cache.quote(id)`, `cache.payment(id)`).

### Verificación Fase 3

`bun run dev`, `open localhost:3010`. Recorrido con dos cuentas en dos agencias.
Pegar la URL de un expediente ajeno debe redirigir, no mostrar nada.

---

## Riesgos abiertos (del reporte de Fase 1)

1. RISK — Ningún FK compuesto obliga a que un hijo (`Booking`, `Quote`,
   `BookingItem`) apunte a un padre de la misma agencia. El servicio de Fase 2
   valida cada FK contra `ctx.agencyId`.
2. RISK — `FieldValue` permite fijar más de un id de entidad. El servicio lo
   evita, igual que el CRM.
3. RISK — `ExchangeRate` es global. Un override `MANUAL` de una agencia afecta a
   todas. Si cada agencia necesita su tasa, agregar `agencyId` y unique
   compuesto.
4. RISK — `medicalNotes`, `dietaryNotes`, `documentNumber` en claro. Cifrado y
   retención antes de la primera agencia real.
5. RISK — `bun run dev` corre `dev:prepare` de `@travel/db`. Falla toda la
   corrida de turbo si Postgres 5433 no está arriba.
6. RISK — El hook `pre-push` corre sobre todo el repo. Más lento con el producto
   nuevo. `CRM_SKIP_HOOKS=1` lo salta.
7. NOT DONE — Facturación fiscal (CFDI). Integración con GDS, mayoristas y
   pasarelas de pago.
8. BROKEN — `apps/travel-api/vercel.json` declara 5 crons. Solo
   `/internal/sync/rates` existe. Los otros 4 responden 404. Es una copia sin
   revisar de `apps/api/vercel.json`. La Fase 5A lo corrige.
9. RESUELTO — `docs/travel/plan_05.md` era un duplicado de `docs/travel/plan_04.md`,
   nunca comiteado. Ya no está en el árbol al cerrar la Fase 6.

---

## Ruta de extracción al repo independiente

Cuando la base sea sólida:

1. `git mv` de `apps/travel-*` y `packages/travel-*` al repo nuevo.
2. Copiar `packages/env` y `packages/typescript-config` (hojas sin acoplamiento).
3. Copiar `packages/ui` y quitar su dependencia a `@crm/db`: mover `isMirrored` e
   `isOptimizable` a `packages/ui/src/lib/blob-image.ts`, actualizar
   `entity-logo.tsx`.
4. Renombrar `@crm/*` a `@travel/*` en los tres packages copiados.
5. Copiar `turbo.json`, `biome.jsonc`, `knip.json`, `.githooks/`, CI y
   `docker-compose.yml`, quedándose con la sección travel.
6. Quitar los prefijos `TRAVEL_` de las variables.
