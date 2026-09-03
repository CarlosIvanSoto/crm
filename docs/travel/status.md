# Producto de viajes — estado de implementación

Fecha de corte: 2026-09-03. Plan aprobado: `docs/travel/plan_01.md`. La Fase 2
se corta en dos rebanadas: `docs/travel/plan_02.md` es la Fase 2A.

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
| 4 | Comisiones al asesor | PLANEADO — `docs/travel/plan_04.md` |
| — | Tareas con cron, documento de cotización, `apps/travel-agent` | FUERA DE ALCANCE. Cada una necesita su plan |

El plan de la Fase 3 es `docs/travel/plan_03.md`. Se corta en tres rebanadas.

El plan de la Fase 4 es `docs/travel/plan_04.md`. Cubre **solo comisiones**. Se
corta en dos rebanadas: 4A datos y API, 4B la app. Sin código todavía.

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
- **`record-stack.ts`** ya tiene su `timelineTabParser` desde 3B; 3C no lo toca.

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

## Fase 4 — PLANEADO — comisiones al asesor

Plan: `docs/travel/plan_04.md`. Alcance: **solo comisiones**. Tareas, documento
de cotización y `apps/travel-agent` quedan fuera. Sin código todavía.

### Problema

La agencia sabe cuánto vendió y cuánto ganó. No sabe cuánto le debe a cada
asesor. Falta la fila que congela la comisión y el reporte que la suma.

### Rebanada 4A — datos y API

- **Modelo `Commission`** en `packages/travel-db/prisma/schema.prisma`. Plantilla:
  `Payment`. Enums `CommissionBasis` (`MARGIN`/`SELL`/`FIXED`) y
  `CommissionStatus` (`PENDING`/`APPROVED`/`PAID`/`VOID`).
- **`basisBaseAmount` y `amountBase` se congelan al crear.** `MARGIN` y `SELL`
  nacen en moneda base. `FIXED` pasa por `ConversionService.itemFields()`. Solo
  `amountBase` se suma. Tasa faltante es `null`, nunca cero.
- **`"Commission"` entra en `TENANT_MODELS`** (`packages/travel-db/src/tenancy.ts`).
  Sin eso el modelo queda sin alcance.
- **`AgencySettings`** gana `defaultCommissionBasis` y `defaultCommissionRate`.
- **Predicado `canManageCommission`** en `packages/travel-auth/src/agency.ts`
  (admin o contable). Un `agent` ve solo sus filas; el filtro `userId` es del
  servicio, nunca un input.
- **Módulo `commissions`** en `apps/travel-api/src/commissions/`, forma de cuatro
  archivos. Procedimientos: `list`, `byBooking`, `create`, `update`, `approve`,
  `markPaid`, `void`, `remove`, `recalculate`, `byAdvisor`, `bySupplier`.
- **Cierra el pendiente de 3C:** `bookings.service.ts:133,236` y
  `quotes.service.ts:226` reciben `role` y anulan `marginBase` sin `canSeeMargins`.
- **Pruebas:** `commissions.spec.ts` con aislamiento entre agencias, filtro por
  rol, congelado del monto, tasa faltante, `FIXED` en otra moneda.

### Rebanada 4B — la app

- **Lista** `app/(app)/[agency]/commissions/`, plantilla de cinco archivos de
  `suppliers/`. Facetas `status` y `basis`. El clic abre la ficha de la reserva.
- **Panel compartido** `commissions-panel.tsx`, forma de `payments-panel.tsx`.
  Página y pestaña de `booking-sheet.tsx` con el mismo componente.
- **Reportes** by advisor y by supplier, dos `SimpleTable` en un `DashboardRow`.
  Tarjeta "Top advisors" en el tablero.
- **Ajustes** `settings/commissions/` escribe los valores por defecto por
  `agency.updateProfile`.
- **Cableado:** renglón en `app-icon-rail.tsx`, `/commissions` en `proxy.ts`
  `SECTIONS`, `cache.commission()` en `lib/trpc/cache.ts`.

### Documentos al cerrar

`docs/travel/money.md` gana la sección "Comisiones". `docs/travel/api.md` gana el
router `commissions` y `canManageCommission`. Este archivo gana 4A y 4B con
verificado y pendientes.

### Riesgos

- `Commission` fuera de `TENANT_MODELS` fuga entre agencias.
- El monto congelado se desincroniza si cambia el itinerario. `recalculate` es
  manual.
- `ExchangeRate` global: una comisión `FIXED` usa una tasa que otra agencia
  sobrescribe con `MANUAL`.
- Sin tasa por asesor, sin creación automática al confirmar, sin fila de egreso
  al pagar.

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
