# Producto de viajes — estado de implementación

Fecha de corte: 2026-09-02. Plan aprobado:
`docs/travel/plan_01.md`.

Este archivo dice qué está hecho, qué falta y en qué orden seguir. Las reglas de
cada área están en `docs/travel/domain.md`, `docs/travel/money.md` y
`docs/travel/api.md`.

---

## Resumen de fases

| Fase | Alcance | Estado |
| --- | --- | --- |
| 0 | Andamiaje del monorepo | HECHO |
| 1 | `packages/travel-db` (`@travel/db`) | HECHO (falta migración SQL) |
| 2 | `apps/travel-api` + `@travel/auth` + `@travel/validation` | NO EMPEZADO |
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

## Fase 1 — HECHO (menos la migración SQL)

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

### Falta en Fase 1

- **La migración SQL inicial.** `packages/travel-db/prisma/migrations/` está
  vacío. La crea `bun run travel:migrate` contra la base local.
- **Correr `test/tenancy.spec.ts`.** Necesita Postgres 5433 y
  `TRAVEL_TEST_DATABASE_URL`.

Comandos:

```sh
docker compose up -d
cp .env.example .env          # llenar DATABASE_URL y TRAVEL_DATABASE_URL
bun install
bun run travel:migrate        # crea la migración inicial
bun run travel:test           # crea travel_test y migra
bun run --filter=@travel/db test
bun run travel:seed
```

---

## Fase 2 — NO EMPEZADO — `apps/travel-api`

### 2.1 Paquete `packages/travel-auth` (`@travel/auth`)

Fork de `packages/auth`. Diferencias:

- `organization` plugin como tenencia real: `allowUserToCreateOrganization: true`,
  flujo de invitaciones activo.
- `emailAndPassword: { enabled: true }`, Google opcional y separado del CRM.
- Sin `ALLOWED_SIGN_IN` (es SaaS).
- `AUTH_COOKIE_PREFIX = "travel"` en `advanced.cookiePrefix` y en `proxy.ts`.
- Roles: `owner`, `admin`, `agent`, `accountant`. Predicados `canManageAgency`,
  `canSeeMargins`, `canRecordPayment` usados en servicio y UI.
- Script `auth:generate` propio que escribe en
  `packages/travel-db/prisma/schema.prisma`, con su tarea de turbo.
- `prismaAdapter(db)` apuntando al singleton de `@travel/db`.

### 2.2 Paquete `packages/travel-validation` (`@travel/validation`)

Fork del patrón de `packages/validation`. Un módulo Zod por concepto, un
subpath export por módulo. Primer módulo obligatorio:
`src/itinerary-item.ts` — `itineraryDetails` como `z.discriminatedUnion("type", …)`
con `parseItineraryDetails(value: unknown)`. Patrón:
`packages/validation/src/agent-manifest.ts`.

### 2.3 App `apps/travel-api` (`travel-api`)

Copiar de `apps/api` y adaptar:

- Seis carpetas de infra casi sin cambios: `config`, `database`, `trpc`,
  `logging`, `cache`, `health`.
- `src/main.ts` — `PORT` → `TRAVEL_PORT ?? 3011`.
- `src/create-app.ts` — `bodyParser: false`, `helmet()`, `ValidationPipe`
  global, puente REST `/rest` antes de `app.init()`.
- `src/app.module.ts` — `LoggingModule` primero.
- `src/config/env.validation.ts` — variables `TRAVEL_*`.
- `package.json` — nombre `travel-api`, `exports: { "./app-router":
  "./src/generated/server.ts" }`.
- `turbo.json` — cadena `trpc:generate` → `check-types`, `passThroughEnv` con
  `TRAVEL_*`.
- `api/index.ts`, `scripts/build-func.mjs`, `vercel.json` — despliegue
  serverless. Migraciones solo en build de producción.
- `src/generated/server.ts` — generado y commiteado.

**Pieza nueva:** `src/trpc/middlewares/agency.middleware.ts`. Corre después de
`AuthMiddleware`. Lee `session.activeOrganizationId`, busca el `Member`, y
estrecha el contexto a `AgencyTrpcContext = AuthedTrpcContext & { agencyId,
role }`. Todo router de dominio lleva
`@UseMiddlewares(AuthMiddleware, AgencyMiddleware)` a nivel de clase.

**Módulos de dominio** (forma de 4 archivos: `module`/`router`/`service`/
`contracts`): `customers`, `travelers`, `suppliers`, `quotes`, `bookings`,
`payments`, `fields`, `saved-views`, `currency`, `agency`, `users`, `activities`.

Copiar `apps/api/src/trpc/list-input.ts` entero (genérico).

Cada servicio: `const scoped = agencyDb(this.raw, ctx.agencyId)` por método.
Nunca toca el cliente crudo. Cada FK entrante se valida contra `ctx.agencyId`
antes de escribir (ver Issue 3 del reporte de Fase 1).

### Verificación Fase 2

```sh
bun run travel:test
bun run --filter=travel-api test    # un spec por servicio: ningún input Zod acepta agencyId
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
