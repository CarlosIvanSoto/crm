# Plan — Producto para agencias de viajes dentro de este monorepo

## Contexto

Este repositorio contiene un CRM: `apps/app` (Next 16), `apps/api` (NestJS +
nestjs-trpc), `apps/agent` (eve) y siete packages compartidos. El CRM es
**single-tenant duro**: no existe `organizationId` en ningún registro de negocio,
y `packages/db/src/workspace.ts` fija `WORKSPACE_ID = "workspace"`.

Queremos un segundo producto, para agencias de viajes, con app, api y base de
datos propias. Vive aquí mientras madura. Después se extrae a su propio
repositorio y su propio monorepo.

El objetivo del plan es doble. Primero, entregar el producto. Segundo, que la
extracción futura sea mover carpetas y no desenredar dependencias. Cada decisión
de abajo se toma con esa segunda meta presente.

---

## Decisiones fijadas

| Decisión | Elección |
| --- | --- |
| Tenencia | Multi-agencia real. `agencyId` en toda tabla de negocio |
| Ubicación | `apps/travel-app`, `apps/travel-api`, `packages/travel-db` |
| Packages nuevos | `@travel/db`, `@travel/auth`, `@travel/validation` |
| Packages compartidos | `@crm/ui`, `@crm/env`, `@crm/typescript-config` |
| Packages forkeados | `db`, `auth`, `validation`, `telemetry` |
| Base de datos | Segundo Postgres, puerto 5433, `TRAVEL_DATABASE_URL` |
| Puertos | app `:3010`, api `:3011` |
| Prefijo de cookie | `travel` |
| Prefijo de variables | `TRAVEL_*` |

**Por qué multi-agencia desde el día 1.** Agregar `agencyId` después significa
migrar toda tabla, reescribir todo `where` y auditar toda consulta. El costo
inicial es bajo. El costo posterior es el producto entero.

---

## Fase 0 — Andamiaje del monorepo

Nada de dominio todavía. Esta fase deja el repositorio listo para dos productos.

### 0.1 Segunda base de datos

`docker-compose.yml` gana un segundo servicio. Compose no crea dos bases en un
contenedor sin script de arranque. Un segundo contenedor cuesta ocho líneas y
aísla por completo.

```yaml
travel-postgres:
  image: postgres:17-alpine
  container_name: travel-postgres
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: travel
  ports: ["5433:5432"]
  volumes: [travel-postgres:/var/lib/postgresql/data]
```

### 0.2 Variables de entorno

Un solo `.env` en la raíz. Es la regla de `docs/environment.md` y no cambia.

Agrega a `.env.example` una sección `# Travel` con:
`TRAVEL_DATABASE_URL`, `TRAVEL_TEST_DATABASE_URL`, `TRAVEL_BETTER_AUTH_SECRET`,
`TRAVEL_API_URL`, `TRAVEL_APP_URL`, `TRAVEL_PORT`, `TRAVEL_AUTH_COOKIE_DOMAIN`,
`TRAVEL_CRON_SECRET`, `TRAVEL_GOOGLE_CLIENT_ID`, `TRAVEL_GOOGLE_CLIENT_SECRET`,
`TRAVEL_BLOB_READ_WRITE_TOKEN`.

Cada variable nueva tiene **tres casas**, no dos:

1. `.env.example`, con su nota.
2. `globalPassThroughEnv` en `turbo.json` de la raíz.
3. `apps/travel-api/src/config/env.validation.ts`, si la API la lee.

Turbo oculta toda variable no declarada. Un despliegue correcto entrega
`undefined` y nada lo dice.

### 0.3 Nombres de scripts de base de datos

Los scripts `db:*` de la raíz son fan-outs de turbo. Un package nuevo con el
script `db:reset` se resetearía junto con el CRM. Eso destruye datos.

`packages/travel-db` usa nombres propios para todo lo destructivo:

| Script | Nombre en `@travel/db` |
| --- | --- |
| Migrar | `travel:migrate` |
| Sembrar | `travel:seed` |
| Resetear | `travel:reset` |
| Studio | `travel:studio` |
| Desplegar | `travel:deploy` |
| Base de prueba | `travel:test` |

Y usa los nombres compartidos solo para lo seguro y aditivo: `build`
(`prisma generate`), `postinstall` y `dev:prepare`. `dev` en la raíz depende de
`^dev:prepare`, así que `bun run dev` prepara ambas bases sin configuración
extra.

La raíz gana los alias `travel:migrate`, `travel:seed`, `travel:reset`,
`travel:studio`, `travel:deploy` y `travel:test`, cada uno
`turbo run <script> --filter=@travel/db`.

### 0.4 Guardas de base de datos

`packages/db/scripts/require-local-db.ts` lee `DATABASE_URL` por nombre literal.
Lo mismo hacen `test-db.ts` y `prepare-dev.ts`.

Copia los tres a `packages/travel-db/scripts/` y cambia el nombre de la variable
a `TRAVEL_DATABASE_URL` y `TRAVEL_TEST_DATABASE_URL`. Son ~250 líneas estables y
el producto se extrae después. Duplicarlos es más barato que parametrizar dos
paquetes que van a separarse.

### 0.5 Configuración de herramientas

- **`biome.jsonc`** — agrega tres overrides. `apps/travel-app/**` con los dominios
  `next` y `react`. `apps/travel-api/**` con `useImportType: "off"`, porque los
  decoradores de Nest necesitan el import de valor. `apps/travel-api/src/**` con
  `noConsole: "error"`. Sin ellos el app pierde las reglas de React y la API no
  compila el lint.
- **`knip.json`** — los apps se enumeran uno por uno. Copia el bloque de
  `apps/app` y el de `apps/api` con las rutas nuevas. `packages/*` ya está
  cubierto por el glob genérico.
- **`.github/workflows/ci.yml`** — segundo servicio Postgres con
  `POSTGRES_DB: travel_test` en el puerto 5433, y un paso `travel:deploy` antes
  de `check-types`.

### 0.6 Documentación

`AGENTS.md` tiene una tabla índice que dice qué leer antes de tocar cada área.
Agrega tres renglones:

| Working on | Read first |
| --- | --- |
| `apps/travel-api`, `apps/travel-app` — tenencia, tRPC, dinero | `docs/travel/api.md` |
| El modelo de datos de viajes | `docs/travel/domain.md` |
| Cotizaciones, reservas, pagos, comisiones | `docs/travel/money.md` |

Escribe esos tres documentos al final de cada fase, no al inicio. Un documento
escrito antes del código describe intenciones, no reglas.

---

## Fase 1 — `packages/travel-db`

### 1.1 Estructura

Copia la forma de `packages/db`, no su contenido.

```
packages/travel-db/
  package.json          @travel/db, private, type: module, source-only
  prisma.config.ts      datasource: env("TRAVEL_DATABASE_URL")
  prisma/schema.prisma
  prisma/migrations/
  prisma/seed.ts
  scripts/              require-local-db.ts, test-db.ts, prepare-dev.ts
  src/client.ts         el singleton crudo
  src/tenancy.ts        agencyDb() — ver 1.3
  src/index.ts          barril
  src/generated/prisma  gitignored
```

`prisma.config.ts` sigue el patrón de `packages/db/prisma.config.ts`: importa
`@crm/env/load` primero, después declara schema, migrations y datasource.

El generador escribe TypeScript a `src/generated/prisma`, igual que el CRM. No
hay paso de build. Bun y Next transpilan la fuente.

### 1.2 Modelo de datos

Enums y modelos. Toda tabla de negocio lleva `agencyId String` y
`@@index([agencyId, ...])` en cada índice.

**Tenencia y usuarios** (tablas de better-auth, generadas por `auth:generate`):
`User`, `Session`, `Account`, `Verification`, `RateLimit`, `Organization`,
`Member`, `Invitation`, `Apikey`.

`Organization` **es** la agencia. A diferencia del CRM, aquí el plugin de
organización es la frontera de tenencia real, no una fila singleton.

**Perfil y consecutivos**

- `AgencySettings` — `agencyId` (único), razón social, RFC, régimen fiscal,
  dirección, teléfono, `baseCurrency`, `timezone`, `logoUrl`, `quotePrefix`,
  `bookingPrefix`, términos por defecto.
- `AgencyCounter` — `agencyId`, `kind` (`QUOTE` | `BOOKING`), `value`.
  `@@id([agencyId, kind])`. Ver 1.4.

**Clientes y pasajeros**

- `Customer` — `type` (`PERSON` | `COMPANY`), `name`, `legalName`, `taxId`,
  `taxRegime`, `email`, `phone`, `whatsapp`, `addressJson`, `ownerId`,
  `lastActivityAt`, `archivedAt`.
- `Traveler` — `firstName`, `lastName`, `dateOfBirth`, `gender`, `nationality`,
  `documentType` (`PASSPORT` | `ID` | `VISA`), `documentNumber`,
  `documentIssuedCountry`, `documentExpiresAt`, `dietaryNotes`, `medicalNotes`,
  `emergencyContactJson`, `customerId` (opcional).
- `TravelerLoyalty` — `travelerId`, `supplierId`, `programName`, `number`.

`medicalNotes`, `documentNumber` y `dietaryNotes` son datos personales
sensibles. Ver la lista de Issues.

**Proveedores**

- `Supplier` — `kind` (`WHOLESALER` | `DMC` | `HOTEL` | `AIRLINE` | `CRUISE` |
  `INSURANCE` | `TRANSFER` | `TOUR_OPERATOR` | `CAR_RENTAL` | `OTHER`), `name`,
  `email`, `phone`, `defaultCommissionRate`, `paymentTermsDays`,
  `defaultCurrency`, `notes`, `archivedAt`.

**Cotización**

- `Quote` — `folio`, `customerId`, `ownerId`, `status` (`DRAFT` | `SENT` |
  `ACCEPTED` | `DECLINED` | `EXPIRED`), `validUntil`, `travelStartDate`,
  `travelEndDate`, `paxAdults`, `paxChildren`, `paxInfants`, `destination`,
  `currency`, `notes`, `terms`, `sentAt`, `decidedAt`, `archivedAt`.
  `@@unique([agencyId, folio])`.
- `QuoteOption` — `quoteId`, `label` ("Económica", "Premium"), `position`,
  `isRecommended`, totales congelados. Las agencias cotizan dos o tres
  alternativas. Esta tabla es lo que separa este producto de un CRM.
- `QuoteItem` — misma forma que `BookingItem`, abajo, con `quoteOptionId`.

**Reserva (expediente)**

- `Booking` — `folio`, `customerId`, `ownerId`, `quoteId` (opcional),
  `status` (`DRAFT` | `CONFIRMED` | `TRAVELING` | `COMPLETED` | `CANCELLED`),
  `travelStartDate`, `travelEndDate`, `destination`, `currency`, totales,
  `lastActivityAt`, `archivedAt`. `@@unique([agencyId, folio])`.
- `BookingTraveler` — `bookingId`, `travelerId`, `paxType` (`ADULT` | `CHILD` |
  `INFANT`), `isLead`. Es la tabla puente.
- `BookingItem` — el servicio del itinerario. Columnas comunes:
  `type` (`FLIGHT` | `HOTEL` | `TRANSFER` | `TOUR` | `CRUISE` | `INSURANCE` |
  `CAR_RENTAL` | `PACKAGE` | `OTHER`), `supplierId`, `confirmationCode`,
  `status` (`QUOTED` | `REQUESTED` | `CONFIRMED` | `CANCELLED`), `startsAt`,
  `endsAt`, `startLocation`, `endLocation`, `description`, `paxCount`,
  `position`, más las columnas de dinero de 1.5, y **`details Json`**.

### 1.3 `details` es una unión discriminada, no un `Record`

`AGENTS.md` prohíbe pasar `Record<string, unknown>`. `BookingItem.details` se
parsea una vez, al leer, con Zod, en `packages/travel-validation/src/itinerary-item.ts`.
`packages/validation/src/agent-manifest.ts` es el patrón exacto a copiar.

```ts
export const itineraryDetails = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FLIGHT"),
    airline: z.string().trim().min(1).max(120),
    flightNumber: z.string().trim().min(1).max(12),
    cabin: z.enum(["ECONOMY", "PREMIUM", "BUSINESS", "FIRST"]),
    departureAirport: z.string().length(3),
    arrivalAirport: z.string().length(3),
    baggage: z.string().trim().max(200).nullable(),
  }),
  z.object({
    type: z.literal("HOTEL"),
    hotelName: z.string().trim().min(1).max(200),
    roomType: z.string().trim().max(120),
    mealPlan: z.enum(["ROOM_ONLY", "BREAKFAST", "HALF", "FULL", "ALL_INCLUSIVE"]),
    nights: z.number().int().min(1).max(365),
  }),
  // TRANSFER, TOUR, CRUISE, INSURANCE, CAR_RENTAL, PACKAGE, OTHER
]);

export type ItineraryDetails = z.infer<typeof itineraryDetails>;
export function parseItineraryDetails(value: unknown): ItineraryDetails { … }
```

El esquema describe lo que **está guardado**, no lo más permisivo que parsea. Un
fallo de parseo es un error con mensaje. No se traga a un objeto vacío.

### 1.4 Tenencia: el contrato

Este es el corazón del producto. Tres reglas, y una de ellas la impone el código.

**Regla 1 — `agencyId` nunca es un input.** Viene de
`session.activeOrganizationId`. Un procedimiento tRPC que acepte `agencyId` en su
esquema Zod es un bug de seguridad, no una decisión de diseño.

**Regla 2 — los servicios no ven el cliente crudo.** `src/tenancy.ts` exporta:

```ts
export function agencyDb(client: Db, agencyId: string): AgencyDb;
```

Devuelve una extensión de Prisma (`$extends`) que, para todo modelo del registro
`TENANT_MODELS`:

- inyecta `where: { agencyId }` en `findMany`, `findFirst`, `count`,
  `aggregate`, `groupBy`, `updateMany`, `deleteMany`, `update`, `delete`;
- inyecta `data.agencyId` en `create`, `createMany` y `upsert`;
- **lanza** en `findUnique` y `findUniqueOrThrow`. Prisma no acepta un filtro no
  único ahí, así que esas operaciones escaparían el alcance en silencio.

**Regla 3 — se lee por `findFirst({ where: { id, agencyId } })`, nunca por
`findUnique`.** La extensión la impone. Un servicio no puede leer la fila de otra
agencia porque nunca recibe un cliente sin alcance.

`DatabaseModule` provee el cliente crudo. El servicio hace
`const db = agencyDb(this.raw, agencyId)` en cada método. Es explícito, barato y
se prueba con un spec que crea dos agencias y verifica que una no ve a la otra.

**Consecutivos de folio.** `nextFolio(tx, agencyId, kind)` corre dentro de la
misma transacción que la creación:

```sql
UPDATE "agencyCounter" SET value = value + 1
WHERE "agencyId" = $1 AND kind = $2 RETURNING value
```

Formatea a `COT-2026-0142` y `EXP-2026-0087` con el prefijo de `AgencySettings`.

### 1.5 Dinero

Un viaje se compra al proveedor en una moneda y se vende al cliente en otra. Este
producto es más multimoneda que el CRM, no menos.

Copia el contrato de `docs/currency.md` sin inventar nada:

- `costAmount Decimal(14,2)` + `costCurrency`, lo que se paga al proveedor.
- `sellAmount Decimal(14,2)` + `sellCurrency`, lo que paga el cliente.
- `costBaseAmount` y `sellBaseAmount`, ambos `Decimal(24,4)`, más `baseCurrency`,
  `fxRate Decimal(20,10)` y `fxRateAt`.
- **Solo las columnas `*BaseAmount` se suman.** Un `_sum` sobre `sellAmount`
  suma pesos con dólares y no avisa.
- La tasa se resuelve una vez y se congela. Convertir al leer cambia el margen de
  un expediente cerrado cada mañana.
- Una tasa faltante es `null`, y se declara. Nunca cero.
- `ExchangeRate` se copia tal cual desde `packages/db/prisma/schema.prisma:964`,
  con su `@@unique([baseCurrency, quoteCurrency, source])` y la regla de que
  `MANUAL` gana a `FETCHED`.

`margin = sellBaseAmount - costBaseAmount`. Es una lectura derivada, no una
columna. La comisión al asesor sí es una fila, en la fase 4.

**Cobros y pagos**

- `Payment` — cobro al cliente. `bookingId`, `dueDate`, `amount`, `currency`,
  columnas base, `status` (`SCHEDULED` | `PAID` | `VOID`), `method` (`CASH` |
  `TRANSFER` | `CARD` | `LINK` | `OTHER`), `paidAt`, `reference`.
  El plan de pagos es el conjunto ordenado de filas `SCHEDULED`. No hay modelo
  aparte.
  **`OVERDUE` no es un estado guardado.** Se deriva de
  `status = SCHEDULED AND dueDate < now()`. Un estado guardado necesita un cron
  que lo mantenga y se desincroniza el día que el cron falla.
- `SupplierPayment` — cuenta por pagar. `supplierId`, `bookingId`,
  `bookingItemId` (opcional), mismas columnas de fecha, monto y estado.

**Resto**

- `Document` — `bookingId` o `travelerId`, `kind` (`VOUCHER` | `TICKET` |
  `INVOICE` | `PASSPORT` | `VISA` | `INSURANCE_POLICY` | `OTHER`), `url`,
  `filename`, `contentType`, `sizeBytes`, `uploadedById`. Vercel Blob, igual que
  el CRM.
- `Activity` — copia la forma del CRM. `kind` (`NOTE` | `CALL` | `EMAIL` |
  `MEETING` | `TASK` | `SYSTEM`), `customerId`, `quoteId`, `bookingId`,
  `userId`, `occurredAt`. Escribe `lastActivityAt` en el registro padre en la
  misma transacción. `ActivityStampService` en `apps/api/src/crm/` es el patrón.
- `FieldDefinition`, `FieldOption`, `FieldValue` y el enum `FieldEntity` — copia
  literal del CRM. El sistema de campos personalizados es genuinamente genérico y
  su capa de UI ya existe.
- `SavedView` — copia literal.

### 1.6 Semilla

`prisma/seed.ts` con PRNG determinista, igual que `packages/db/prisma/seed.ts`.
Siembra **dos agencias**, no una. Una semilla de una sola agencia no prueba nada
sobre el aislamiento.

---

## Fase 2 — `apps/travel-api`

### 2.1 Esqueleto

Seis carpetas de infraestructura se copian de `apps/api/src` casi sin cambios:
`config`, `database`, `trpc`, `logging`, `cache`, `health`.

Archivos raíz a copiar y adaptar:

- `src/main.ts` — `PORT` pasa a `TRAVEL_PORT ?? 3011`.
- `src/create-app.ts` — `bodyParser: false` es obligatorio, better-auth necesita
  el cuerpo crudo. `helmet()`, el `ValidationPipe` global y el puente REST
  `/rest` antes de `app.init()`.
- `src/app.module.ts` — `LoggingModule` **primero**, siempre. Después
  `ConfigModule.forRoot({ validate })`, `AppCacheModule`, `DatabaseModule`,
  `BetterAuthModule.forRoot()`, y los módulos de dominio.
- `package.json` — nombre `travel-api`, y
  `"exports": { "./app-router": "./src/generated/server.ts" }`. El app lo importa
  como `travel-api/app-router`.
- `turbo.json` — copia el de `apps/api`, con la cadena
  `trpc:generate` → `check-types` y el `passThroughEnv` con los nombres `TRAVEL_*`.
- `api/index.ts`, `scripts/build-func.mjs`, `vercel.json` — el despliegue
  serverless. Las migraciones corren en el build de producción y en ningún otro
  lado.

`src/generated/server.ts` se genera **y se commitea**. El generador necesita
GLIBC 2.39, más nuevo que la imagen de build de Vercel. `build` nunca lo
regenera. Solo `check-types` y `dev`.

### 2.2 El middleware de agencia

Es la pieza que no existe en el CRM.

`src/trpc/middlewares/agency.middleware.ts` corre después de `AuthMiddleware`:

```ts
const agencyId = ctx.session?.session.activeOrganizationId;
if (!agencyId) throw new TRPCError({ code: "FORBIDDEN" });
const role = await memberRole(agencyId, ctx.user.id);
if (!role) throw new TRPCError({ code: "FORBIDDEN" });
return next({ ctx: { ...ctx, agencyId, role } });
```

Estrecha el contexto a `AgencyTrpcContext = AuthedTrpcContext & { agencyId, role }`.

Todo router de dominio lleva
`@UseMiddlewares(AuthMiddleware, AgencyMiddleware)` a nivel de clase. **Sin
middleware no hay guarda: el procedimiento queda público.**

### 2.3 Módulos de dominio

Un módulo por área, con la forma rígida de cuatro archivos del CRM:
`*.module.ts`, `*.router.ts`, `*.service.ts`, `*.contracts.ts`.

Fase 2 entrega: `customers`, `travelers`, `suppliers`, `quotes`, `bookings`,
`payments`, `fields`, `saved-views`, `currency`, `agency`, `users`, `activities`.

Reglas que se heredan de `docs/api.md` sin cambios:

- **Los routers son delgados.** Zod entra, servicio sale. Prisma solo vive en
  `*.service.ts`.
- **Filtra, ordena y pagina en Prisma.** Copia
  `apps/api/src/trpc/list-input.ts` completo: `listInput`, `paginate`,
  `resolveOrderBy`, `countsByKey`, `ownerFilter`, `archivedFilter`, y el tipo
  `ListResult<TRow> = { rows, total, facetCounts }`. Es genérico y no sabe nada
  del CRM.
- **Nunca interpoles `sort` en un nombre de campo.** `resolveOrderBy` con un mapa
  declarativo es la única vía.
- **Borrar es archivar primero y purgar después.** `archivedFilter(input.archived)`
  entra en todo `buildWhere` y en todo conteo de facetas.
- Los servicios lanzan las excepciones de Nest. `DomainErrorMiddleware` las
  traduce a códigos tRPC.
- **Nunca `console.log`.** `new Logger(Thing.name)` recoge `ContextLogger`. Un
  objeto por llamada, no argumentos extra. Los errores pasan el stack como
  segundo argumento.
- **Nunca registres cabeceras, query strings ni cuerpos.**

### 2.4 Autenticación — `packages/travel-auth`

Fork de `packages/auth`, con cinco diferencias que importan:

| Aspecto | CRM | Viajes |
| --- | --- | --- |
| Organización | Fila singleton `WORKSPACE_ID` | Tenant real, una por agencia |
| Crear organización | `allowUserToCreateOrganization: false` | `true` |
| Invitaciones | Sin usar | El flujo de alta de asesores |
| Correo y contraseña | Deshabilitado | Habilitado, con Google opcional |
| `ALLOWED_SIGN_IN` | La lista de acceso | No aplica. Es SaaS |
| Prefijo de cookie | `crm` | `travel` |

Roles: `owner`, `admin`, `agent` (asesor), `accountant`. Predicados exportados
(`canManageAgency`, `canSeeMargins`, `canRecordPayment`) y usados **en el
servicio y en la UI**. Así el botón y el 403 no se contradicen.

`auth:generate` del CRM escribe dentro de `packages/db/prisma/schema.prisma`.
`@travel/auth` necesita su propio script apuntando a
`packages/travel-db/prisma/schema.prisma`, y su propia tarea de turbo.

`AUTH_COOKIE_PREFIX = "travel"` se pone en **dos lugares**: `advanced.cookiePrefix`
en `auth.ts` y `getSessionCookie(request, { cookiePrefix })` en `proxy.ts`. Uno
solo redirige toda petición autenticada.

---

## Fase 3 — `apps/travel-app`

### 3.1 Cableado

Tres archivos y el tema queda idéntico al CRM:

1. `app/layout.tsx` línea 1: `import "@crm/ui/globals.css";`
2. `postcss.config.mjs`: `export { default } from "@crm/ui/postcss.config";`
3. `next.config.ts`: `transpilePackages: ["@crm/ui", "@travel/auth", "@travel/db"]`
   y `serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"]`.

`package.json` con `"dev": "next dev --port 3010"`. Sin el puerto explícito,
turbo pelea con el CRM por el 3000.

`components.json` copia el de `apps/app`: `css` apunta a
`../../packages/ui/src/styles/globals.css`, `components` se queda en
`@/components`. Los primitivos compartidos van al package. Los del producto, al
app.

### 3.2 Rutas

```
app/(landing)/          sign-in, sign-up, crear agencia, aceptar invitación
app/(app)/[agency]/
  page.tsx              tablero: ventas del mes, margen, cobros vencidos, salidas
  clientes/
  pasajeros/
  cotizaciones/
  reservas/             el expediente, con el itinerario dentro
  proveedores/
  pagos/                cobranza y cuentas por pagar
  ajustes/              agencia, miembros, monedas, campos, folios
```

El slug de la URL es el de la agencia. A diferencia del CRM, **aquí sí es
tenencia**, no cosmética. `proxy.ts` verifica que la sesión tenga membresía en esa
agencia antes de dejar pasar. Un slug ajeno redirige, no muestra.

Cada entidad repite la plantilla de cinco archivos de
`apps/app/app/(app)/[slug]/companies/`:

- `page.tsx` — servidor. `requireSession()`, carga search params, `prefetchQuery`,
  envuelve en `<HydrateClient>`.
- `<entidad>-search-params.ts` — tres líneas sobre `createListSearchParams`.
- `<entidad>-table.tsx` — cliente. Un arreglo `COLUMNS` y `useTableQuery`.
- `<entidad>-bulk-actions.tsx`
- `create-<entidad>-sheet.tsx`

### 3.3 Qué se reusa, qué se copia, qué se promueve

**Se importa de `@crm/ui` sin tocar nada** — 72 primitivos, incluidos
`data-table.tsx`, `card-table.tsx`, `simple-table.tsx`, `dashboard.tsx`,
`dashboard-chart.tsx`, `stat-card.tsx`, `combobox`, `command`, `field`,
`save-bar`, `sheet`, `drawer`, más `hooks/use-table-selection` y
`lib/{utils,format,table-query,row-accent}`.

**Verificado:** `@crm/ui` declara `@crm/db` como dependencia, pero el acoplamiento
es un solo archivo. `entity-logo.tsx` importa `isOptimizable` desde
`@crm/db/images`, que es un módulo hoja sin imports propios. Prisma **no** entra
al grafo del navegador. Compartir `@crm/ui` hoy es seguro.

**Se promueve a `packages/ui` antes de empezar la fase 3.** Cuatro archivos de
`apps/app` sin ningún conocimiento del CRM. Radio de impacto pequeño, reuso
grande:

| Archivo actual | Destino |
| --- | --- |
| `apps/app/components/data-table/list-search-params.ts` | `packages/ui/src/lib/` |
| `apps/app/components/data-table/use-table-query.ts` | `packages/ui/src/hooks/` |
| `apps/app/components/crm/record-sheet/record-stack.ts` | `packages/ui/src/lib/` |
| `apps/app/lib/search-param-keys.ts` | `packages/ui/src/lib/` |

`record-stack.ts` es la pila de fichas abiertas codificada en la URL. Es
mecanismo puro y es lo que evita construir un árbol de rutas
`/reservas/[id]/pasajeros/[id]/editar`.

**Se copia al app nuevo.** `page-shell.tsx`, `detail-sheet.tsx`,
`responsive-sheet.tsx`, `app-header.tsx`, `app-icon-rail.tsx`, `lib/trpc/*`,
`lib/session.ts`. Son baratos de duplicar y van a divergir. Se promueven después,
cuando ambos productos coincidan en la forma.

`lib/trpc/cache.ts` se reescribe entero. La fachada de invalidación es específica
del dominio: `cache.booking(id)`, `cache.quote(id)`, `cache.payment(id)`. **Una
mutación nueva agrega una llamada ahí, no una lista de claves en el sitio de uso.**

### 3.4 Reglas de UI que no se negocian

- `/packages/ui` es la única fuente de verdad. Una variante nueva se implementa
  ahí, no con `className` en el sitio de uso.
- Radios solo de la escala: `rounded-sm`, `rounded-md`, `rounded-lg`.
  `rounded-none` solo para unir bordes.
- Solo dos cosas llevan relleno: `primary` para la acción que quieres, y
  `destructive` para la que no se deshace.
- **Una página de servidor calcula. Un componente cliente renderiza.** Un archivo
  `"use client"` no importa `@travel/db` ni `@travel/auth`. El bundler sigue la
  cadena hasta `pg` y hasta `dns`, y el build falla.
- El componente cliente declara sus propios tipos de props. No reexporta un tipo
  de servidor para obtenerlos.

---

## Fase 4 — Después de la base sólida

Fuera del alcance inicial. Se listan para que el modelo de datos no las bloquee.

- `Commission` — comisión al asesor. `bookingId`, `userId`, `basis`, `rate`,
  `amount`, `status`. El reporte por asesor y por proveedor.
- `Task` y recordatorios — pago vencido, documento por vencer, salida próxima.
  Cron con `TRAVEL_CRON_SECRET`, que **falla cerrado** si la variable no existe.
- Documento de cotización para el cliente, en PDF o en enlace público.
- Un agente propio en `apps/travel-agent`. **Ninguna inteligencia entra a la
  API.** Ni cliente de proveedor, ni parseo de correos de mayoristas, ni
  sugerencias. La API escribe una fila de tarea y deja que el agente decida.

---

## Ruta de extracción al repositorio independiente

El plan está armado para que este momento sea mecánico. Cuando llegue:

1. `git mv apps/travel-app apps/travel-api packages/travel-db packages/travel-auth packages/travel-validation` al repo nuevo.
2. Copia `packages/env` y `packages/typescript-config`. Son hojas sin
   acoplamiento. `@crm/env` tiene cero dependencias.
3. Copia `packages/ui` y **entonces** elimina su dependencia a `@crm/db`: mueve
   `isMirrored` e `isOptimizable` a `packages/ui/src/lib/blob-image.ts` y
   actualiza `entity-logo.tsx`. Son dos archivos.
4. Renombra el alcance `@crm/*` a `@travel/*` en los tres packages copiados.
5. Copia `turbo.json`, `biome.jsonc`, `knip.json`, `.githooks/`, el workflow de
   CI y `docker-compose.yml`, quedándote con la sección `travel`.
6. Quita los prefijos `TRAVEL_` de las variables. Ya no hay con qué chocar.

---

## Verificación

**Fase 0**

```sh
docker compose up -d
bun install
bun run travel:migrate && bun run travel:seed
bun run dev                      # app 3000, api 3001, agent 2000, travel 3010/3011
```

`bun run dev` debe preparar **ambas** bases. Si solo prepara una, `dev:prepare`
de `@travel/db` no está en el grafo.

**Fase 1 — el aislamiento es lo único que hay que probar de verdad**

`packages/travel-db/test/tenancy.spec.ts`:

1. Crea dos agencias con una reserva cada una.
2. `agencyDb(db, "a").booking.findMany()` devuelve una sola fila.
3. `agencyDb(db, "a").booking.findFirst({ where: { id: bookingDeB } })` devuelve
   `null`.
4. `agencyDb(db, "a").booking.update({ where: { id: bookingDeB } })` lanza.
5. `agencyDb(db, "a").booking.findUnique(...)` lanza, siempre.
6. `agencyDb(db, "a").booking.create({ data: { ... } })` escribe `agencyId: "a"`
   aunque el `data` traiga `agencyId: "b"`.

Un test que no cubre los seis casos no prueba la tenencia.

**Fase 2**

```sh
bun run travel:test              # crea travel_test, corre migrate deploy
bun run --filter=travel-api test
curl localhost:3011/health
open localhost:3011              # Swagger, con el puente REST de cada procedimiento
```

Un spec por servicio verifica que ningún esquema Zod de entrada acepta
`agencyId`. Es la Regla 1, y una prueba la sostiene mejor que una convención.

**Fase 3**

```sh
bun run dev
open localhost:3010
```

Recorrido completo, con dos cuentas en dos agencias distintas:

1. Crea agencia, invita a un asesor, acepta la invitación.
2. Crea cliente y dos pasajeros con pasaporte y vigencia.
3. Cotiza con dos opciones. Cada una con vuelo, hotel y traslado.
4. Acepta una opción. Verifica que la reserva nace con folio consecutivo.
5. Registra plan de pagos: anticipo y dos parcialidades.
6. Marca la primera como pagada. Verifica el margen en moneda base.
7. **Desde la segunda cuenta, pega la URL del expediente de la primera.**
   Debe redirigir. No debe mostrar nada.

**Antes de cada push**

```sh
bun run check-types && bun run lint && bun run lint:slop && bun run test
```

Los cuatro corren en CI y en el hook de `pre-push`. `lint:slop` sostiene una sola
línea: los datos que cruzan una frontera de E/S se parsean a un tipo de dominio
al llegar. `BookingItem.details` es exactamente ese caso.

---

## Issues

1. RISK — `medicalNotes`, `dietaryNotes` y `documentNumber` guardan datos
   personales sensibles en claro. Una fuga expone pasaportes y datos de salud.
   Fix: no está hecho. Necesita cifrado en columna y una política de retención,
   antes de la primera agencia real.
2. RISK — Compartir `@crm/ui` acopla dos productos a un mismo design system. Un
   cambio para viajes rompe el CRM.
3. RISK — Los scripts `db:*` de la raíz son fan-outs de turbo. Un script
   `db:reset` en `@travel/db` resetearía ambas bases y destruiría datos.
   Fix: nombres `travel:*` para todo lo destructivo. Ver 0.3.
4. RISK — El hook `pre-push` corre `check-types`, `lint`, `lint:slop` y `test`
   sobre todo el repositorio. Cada push se vuelve más lento con el producto
   nuevo.
   Fix: no está hecho. `CRM_SKIP_HOOKS=1` lo salta, pero eso apaga la guarda.
5. RISK — Los tests de integración de ambos productos corren contra Postgres.
   `turbo run test --concurrency=1` los serializa hoy. Bases separadas quitan la
   causa, pero la serialización se mantiene y el CI tarda más.
6. NOT DONE — No hay flujo de facturación fiscal (CFDI). Las agencias en México
   lo necesitan.
7. NOT DONE — No hay integración con GDS, mayoristas ni pasarelas de pago. Todo
   dato de itinerario se captura a mano.
8. UNKNOWN — El país y la moneda base del primer cliente. Decide el formato de
   los datos fiscales en `Customer` y `AgencySettings`.
9. UNKNOWN — Si las agencias necesitan sucursales. Agregar `branchId` después
   cuesta lo mismo que agregar `agencyId` después.
