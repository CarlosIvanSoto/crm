# Producto de viajes — estado de implementación

Fecha de corte: 2026-09-02. Plan aprobado: `docs/travel/plan_01.md`. La Fase 2
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
| 2B | Módulos `travelers`/`suppliers`/`payments`/`activities`/`fields`/`saved-views`, `currency` completo | NO EMPEZADO |
| 3 | `apps/travel-app` | NO EMPEZADO |
| 4 | Comisiones, tareas, PDF, `apps/travel-agent` | FUERA DE ALCANCE INICIAL |

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

## Fase 2B — NO EMPEZADO — el resto de `apps/travel-api`

La infraestructura, `@travel/auth`, `@travel/validation` y el `AgencyMiddleware`
ya existen (Fase 2A). 2B agrega módulos de dominio a la misma app, con la misma
forma de 4 archivos y las mismas reglas del `agencyDb`.

**Módulos que faltan:** `travelers`, `suppliers`, `payments`, `activities`,
`fields`, `saved-views`. Más el módulo `currency` completo: `RatesService`,
`RatesController` (cron `TRAVEL_CRON_SECRET`, falla cerrado), `CurrencyService`
(pantalla de ajustes), y el cron de tasas en `vercel.json`.

**Trae consigo:**

- `ActivityStampService` de `apps/api/src/crm/` → `apps/travel-api/src/travel/`.
  En 2A `Customer.lastActivityAt` y `Booking.lastActivityAt` quedan nulos.
- `@travel/db/src/fields.ts` y `fields-shape.ts`, copiados de `@crm/db`.
- `@travel/validation/saved-view`, copiado de `packages/validation`.
- Override de `apps/travel-api/src/fields/**` en `.oxlintrc.json`, gemelo del de
  `apps/api/src/fields/**`.

**`payments`:** `OVERDUE` no es un estado guardado. Se deriva de
`status = SCHEDULED AND dueDate < now()`.

### Verificación Fase 2B

```sh
bun run travel:test
bun run --filter=travel-api test
curl localhost:3011/health
open localhost:3011                  # Swagger con el puente REST
```

---

## Fase 3 — NO EMPEZADO — `apps/travel-app`

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
