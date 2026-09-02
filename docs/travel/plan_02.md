# Fase 2A — la columna vertebral de `apps/travel-api`

## Contexto

El monorepo aloja un segundo producto para agencias de viajes. Las fases 0 y 1
están hechas: el andamiaje del repositorio y `packages/travel-db` (`@travel/db`),
con la migración inicial `20260902204400_init` que cubre 30 modelos y 15 enums.

Falta la API. Sin ella no hay app, y el aislamiento entre agencias sigue sin
probarse fuera de un solo spec de Prisma.

La Fase 2 del plan aprobado entrega 12 módulos de dominio. Los equivalentes del
CRM suman ~6,000 líneas. Un diff así no se revisa. Este plan corta la fase en dos:

- **2A — este plan.** Los dos paquetes nuevos, la infraestructura, el
  `AgencyMiddleware` y cinco módulos. Al terminar, dos agencias operan de punta a
  punta y la fuga entre ellas se mide.
- **2B — después.** `travelers`, `suppliers`, `payments`, `activities`, `fields`,
  `saved-views` y el módulo `currency` completo.

Decisiones tomadas: correo de invitación opcional vía Resend; script propio
`travel:auth:generate`.

---

## Lo que ya existe. No lo vuelvas a agregar

| Archivo | Estado |
| --- | --- |
| `turbo.json:37-48` | 12 variables `TRAVEL_*` en `globalPassThroughEnv` |
| `knip.json:27-40` | Bloques de `apps/travel-api`, `apps/travel-app`, `packages/travel-db` |
| `biome.jsonc:98-126` | 3 overrides de travel |
| `.oxlintrc.json:17,19,56` | Generados ignorados; override de `tenancy.ts` |
| `.github/workflows/ci.yml:41-83` | Postgres 5433, env `TRAVEL_*`, paso `travel:deploy` |
| `package.json:25-31` | Alias `travel:*` de la raíz |
| `packages/travel-db` | Completo, con migración inicial |

---

## 1. `packages/travel-validation` (`@travel/validation`)

Copia la forma de `packages/validation`: un módulo por concepto, un subpath
export por módulo, un barril `.` con `schemas` y `parse`.

`src/itinerary-item.ts` es el primer módulo y el obligatorio. El patrón exacto es
`packages/validation/src/agent-manifest.ts`. Reprodúcelo entero, incluida su
división en dos niveles:

- `itineraryDetails` — `z.discriminatedUnion("type", […])` con una rama por valor
  de `ItineraryItemType` (`FLIGHT`, `HOTEL`, `TRANSFER`, `TOUR`, `CRUISE`,
  `INSURANCE`, `CAR_RENTAL`, `PACKAGE`, `OTHER`). El literal de cada rama coincide
  con la columna `type` de la fila.
- `class InvalidItineraryDetails extends Error` con los issues formateados.
- `parseItineraryDetails(value: unknown)` — lanza. Es la vía de escritura.
- `readItineraryDetails(value: unknown)` — degrada a un `UNREADABLE_DETAILS` con
  `.catch()`. Es la vía de lectura de filas ya guardadas, para que un renglón
  viejo no tumbe una lista.

El esquema describe lo que **está guardado**. `docs/travel/plan_01.md:246-268`
tiene las ramas de `FLIGHT` y `HOTEL` ya escritas.

`src/saved-view.ts` se copia de `packages/validation/src/saved-view.ts` en 2B.

**`.oxlintrc.json` gana un override nuevo**, gemelo del de la línea 50:

```json
{ "files": ["packages/travel-validation/src/**"],
  "rules": { "anti-slop/no-unknown-parameters": "off" } }
```

Sin él `parseItineraryDetails(value: unknown)` no pasa `lint:slop`.

---

## 2. `packages/travel-auth` (`@travel/auth`)

Fork de `packages/auth`. Solo estos archivos; el resto del CRM (Slack, SSO,
mailbox, `ALLOWED_SIGN_IN`) no viaja.

| Archivo | Contenido |
| --- | --- |
| `src/cookies.ts` | `AUTH_COOKIE_PREFIX = "travel"`, `SESSION_COOKIE_NAME`. 2 líneas, cero deps. |
| `src/env.ts` | `import "@crm/env/load"` en la línea 1. Lee las variables `TRAVEL_*`. |
| `src/agency.ts` | Roles y predicados. Ver abajo. |
| `src/invitations.ts` | Envío opcional de correo. Ver abajo. |
| `src/auth.ts` | La instancia `betterAuth`. |
| `src/client.ts` | `createAuthClient` con `organizationClient()`. |
| `src/index.ts` | Barril. |

### 2.1 Roles y predicados — `src/agency.ts`

El repositorio **no usa `createAccessControl` de better-auth en ningún lado**.
Los roles son strings y las reglas son funciones exportadas. Copia esa forma de
`packages/auth/src/organization.ts:1-60`, con una diferencia:

```ts
export const AGENCY_ROLES = ["owner", "admin", "agent", "accountant"] as const;
export type AgencyRole = (typeof AGENCY_ROLES)[number];

export function canManageAgency(role: AgencyRole | null): boolean;
export function canManageMembers(role: AgencyRole | null): boolean;
export function canSeeMargins(role: AgencyRole | null): boolean;
export function canRecordPayment(role: AgencyRole | null): boolean;

export async function agencyRoleOf(
  client: AgencyMemberReader,
  organizationId: string,
  userId: string,
): Promise<AgencyRole | null>;
```

`agencyRoleOf` recibe `organizationId` como parámetro. En el CRM es la constante
`WORKSPACE_ID`; aquí eso sería la tenencia rota.

`Member.role` en el schema ya tiene `@default("agent")`.

Los predicados se usan en el servicio **y** en la UI. El botón y el 403 no se
contradicen. `packages/auth/src/slack-connect.ts:17-19` muestra el truco de
filtrar `AGENCY_ROLES` por el predicado para construir un `where` de Prisma, y
así la lista y la regla no se separan nunca.

### 2.2 Invitación por correo — `src/invitations.ts`

El repositorio no tiene ningún transporte de correo. Este es el primero.

Sigue el patrón de `apps/agent/agent/lib/capabilities.ts`: una llave que falta
quita una capacidad y **nunca lanza**.

```ts
export async function sendAgencyInvitation(invite: AgencyInvitation): Promise<InviteDelivery>;
```

- `TRAVEL_RESEND_API_KEY` presente → envía y devuelve `{ delivered: true, url }`.
- Ausente → devuelve `{ delivered: false, url }`. Sin error, sin log de alarma.
- Un fallo del proveedor → `{ delivered: false, url }` y un `logger.warn`. La
  invitación ya está en la base; el enlace sirve igual.

La UI copia `url` siempre. El correo es un extra, no el mecanismo.

Se conecta como `organization({ sendInvitationEmail })`.

### 2.3 `src/auth.ts`

Diferencias contra `packages/auth/src/auth.ts`, y solo estas:

| Aspecto | CRM | Viajes |
| --- | --- | --- |
| `database` | `prismaAdapter(db)` de `@crm/db` | de `@travel/db` |
| `emailAndPassword` | `{ enabled: false }` | `{ enabled: true }` |
| `socialProviders` | Google con scopes de Gmail | Google simple, `TRAVEL_GOOGLE_*`, opcional |
| `organization` | `allowUserToCreateOrganization: false` | `true`, `creatorRole: "owner"`, `sendInvitationEmail` |
| `advanced.cookiePrefix` | `"crm"` | `"travel"` |
| `user.create.before` | Guarda `ALLOWED_SIGN_IN` | **No existe.** Es SaaS |
| `session.create.before` | `ensureWorkspaceMembership` | Fija `activeOrganizationId` a la primera membresía |
| Plugins de más | `genericOAuth` Slack, `sso`, `apiKey` | Ninguno de los tres |

`session.create.before` **degrada, nunca lanza**. Un throw ahí bloquea el ingreso
de todos. Si el usuario no tiene membresía, deja `activeOrganizationId` en null;
`AgencyMiddleware` responde `FORBIDDEN` y el app manda a crear agencia.

### 2.4 `travel:auth:generate`

Script propio, con nombre `travel:*` para que el fan-out `turbo run auth:generate`
de la raíz no lo arrastre:

```json
"travel:auth:generate": "better-auth generate --config src/auth.ts --output ../travel-db/prisma/schema.prisma --y"
```

- `turbo.json` del paquete: tarea `travel:auth:generate`, `cache: false`,
  `passThroughEnv: ["TRAVEL_DATABASE_URL"]`.
- `package.json` de la raíz: `"travel:auth:generate": "turbo run travel:auth:generate --filter=@travel/auth"`.

**El generador reescribe los modelos de auth y borra lo que no conoce.**
`Organization` en `packages/travel-db/prisma/schema.prisma:103-137` tiene 18
relaciones inversas escritas a mano — `quotes`, `bookings`, `customers`,
`settings`, `counters` y las demás. El CLI no las conoce y las quita.

Flujo obligatorio, y un `README.md` del paquete que lo diga:

1. `bun run travel:auth:generate`
2. `git diff packages/travel-db/prisma/schema.prisma` — restaura a mano las
   relaciones inversas de `Organization` y el `@default("agent")` de `Member.role`.
3. `bun run travel:migrate`

---

## 3. `apps/travel-api` — infraestructura

Seis carpetas se copian de `apps/api/src` casi sin cambio. Cambia el import de
`@crm/db` a `@travel/db` y de `@crm/auth` a `@travel/auth`.

| Carpeta | Cambio |
| --- | --- |
| `database/` | `database.constants.ts` idéntico. `database.module.ts`: `db` de `@travel/db`. Sigue `@Global()`. |
| `logging/` | 7 archivos idénticos. `prisma-log.bridge.ts` usa `setPrismaLogSink` de `@travel/db`, que existe. |
| `cache/` | Idéntico. Lee `REDIS_URL` y `CACHE_TTL_MS` compartidos. |
| `health/` | Idéntico. |
| `trpc/` | Ver 3.1. |
| `config/` | Ver 3.2. |

`@crm/telemetry` **no viaja**. Lo usan `logging/all-exceptions.filter.ts` y
`trpc/trpc-error.handler.ts` con `apiError()`. Quita esas dos llamadas; el log
queda.

### 3.1 `src/trpc/`

Copia verbatim: `list-input.ts` (129 líneas, cero dependencias del CRM),
`error-formatter.ts`, `trpc-error.handler.ts`, `openapi.ts`,
`middlewares/{auth,domain-error,logging}.middleware.ts`.

`session-only.middleware.ts` no viaja: no hay plugin `apiKey`.

`context.types.ts` gana un tercer tipo:

```ts
export type AgencyTrpcContext = AuthedTrpcContext & {
  agencyId: string;
  role: AgencyRole;
};
```

**`src/trpc/middlewares/agency.middleware.ts` — la pieza que el CRM no tiene:**

```ts
@Injectable()
export class AgencyMiddleware implements TRPCMiddleware {
  constructor(@InjectDatabase() private readonly db: Db) {}

  async use(opts: MiddlewareOptions): Promise<MiddlewareResponse> {
    const ctx = opts.ctx as AuthedTrpcContext;
    const agencyId = ctx.session?.session.activeOrganizationId;
    if (!agencyId) throw new TRPCError({ code: "FORBIDDEN" });

    const role = await agencyRoleOf(this.db, agencyId, ctx.user.id);
    if (!role) throw new TRPCError({ code: "FORBIDDEN" });

    const nextCtx: AgencyTrpcContext = { ...ctx, agencyId, role };
    return opts.next({ ctx: nextCtx });
  }
}
```

`DatabaseModule` es `@Global()`, así que `@InjectDatabase()` funciona aquí sin
importar nada.

`trpc.module.ts` lo agrega a `providers` **y a `exports`**, junto a
`AuthMiddleware`. Todo módulo de dominio importa `TrpcModule`; de ahí saca los
dos middlewares.

Todo router de dominio lleva, a nivel de clase:

```ts
@UseMiddlewares(AuthMiddleware, AgencyMiddleware)
```

**Sin middleware el procedimiento queda público. No hay otra guarda.**

### 3.2 `src/config/env.validation.ts`

Copia el archivo de `apps/api`. Es `class-validator`, no Zod. Cada `@MinLength`
lleva un `message` que es una oración completa y dice cómo arreglarlo.

- Requeridas: `TRAVEL_DATABASE_URL`, `TRAVEL_BETTER_AUTH_SECRET` (≥32).
- **`ALLOWED_SIGN_IN` no se copia.** `apps/api/src/config/env.validation.ts:47` la
  hace obligatoria; aquí eso rompe el arranque.
- Opcionales: `TRAVEL_API_URL`, `TRAVEL_APP_URL`, `TRAVEL_AUTH_COOKIE_DOMAIN`,
  `TRAVEL_CRON_SECRET` (≥16), `TRAVEL_GOOGLE_CLIENT_ID/SECRET`,
  `TRAVEL_BLOB_READ_WRITE_TOKEN`, `TRAVEL_RESEND_API_KEY`, `REDIS_URL`,
  `CACHE_TTL_MS`.
- Default: `TRAVEL_PORT = 3011`.

`TRAVEL_RESEND_API_KEY` es variable nueva. Tiene **tres casas**:
`.env.example` (sección `# Travel`, con su nota), `globalPassThroughEnv` en el
`turbo.json` de la raíz, y este archivo.

### 3.3 Raíz del app y despliegue

- `src/main.ts` — `TRAVEL_PORT ?? 3011`.
- `src/create-app.ts` — el orden es la mitad del archivo: `bodyParser: false`
  primero (better-auth necesita el cuerpo crudo), `helmet()`, `ValidationPipe`
  global, el middleware diferido de `/rest` y `SwaggerModule.setup` **antes** de
  `app.init()`, y el `restBridge` se llena después. Copia el baile tal cual.
- `src/app.module.ts` — `LoggingModule` **primero**, siempre. Después
  `ConfigModule.forRoot({ validate: validateEnv })`, `AppCacheModule`,
  `DatabaseModule`, `TravelModule`, `BetterAuthModule.forRoot({ auth, middleware: logAuthRoute })`,
  `HealthModule`, `TrpcModule`, y los cinco módulos de dominio.
- `package.json` — nombre `travel-api`, `"exports": { "./app-router": "./src/generated/server.ts" }`,
  y `postinstall: node scripts/chmod-trpc-binary.mjs`. Sin ese chmod la codegen
  falla en una instalación limpia.
- `turbo.json` — `check-types` depende de `trpc:generate`; **`build` no**. Por eso
  `src/generated/server.ts` se commitea. `passThroughEnv` con los nombres `TRAVEL_*`.
- `api/index.ts`, `vercel.json`, `scripts/build-func.mjs`.

**`scripts/build-func.mjs` tiene dos rutas del CRM escritas a mano.** La línea 204
apunta a `packages/db` para `prisma migrate deploy`; pásala a `packages/travel-db`
y a `TRAVEL_DATABASE_URL`. La línea 180 nombra un cron `/internal/sync/google` que
no existe aquí. `vercel.json` empieza sin crons: en 2A no hay ninguno.

---

## 4. Dinero — `@travel/db` gana dos módulos

`@travel/db` no tiene `fx.ts` ni `currency.ts`. `QuoteItem` y `BookingItem`
escriben columnas base desde el primer día, así que 2A los necesita.

Copia de `packages/db/src/`:

- `currency.ts` (59 líneas) — `CURRENCIES`, `isCurrencyCode`, `normalizeCurrency`,
  `minorUnitsOf`. Sin cambios.
- `fx.ts` (90 líneas) — `resolveRate`, `applyRate`, `convertToBase`. Sin cambios.
  `MANUAL` gana a `FETCHED`. `ExchangeRate` es global y **no está en
  `TENANT_MODELS`**, así que `resolveRate` recibe el cliente crudo, no `agencyDb`.

Agrega `"./fx"` y `"./currency"` a los `exports` de `packages/travel-db/package.json`.

**`settings.ts` no se copia.** El CRM lee la moneda de reporte de `AppSetting`,
una fila global. Aquí la moneda base es `AgencySettings.baseCurrency`, una por
agencia. `ConversionService` cambia de forma:

```ts
async baseCurrencyFor(agencyId: string): Promise<string>;
async itemFields(agencyId, amount: Decimal | null, currency: string): Promise<FxFields>;
```

`itemFields` devuelve `{ baseAmount, baseCurrency, fxRate, fxRateAt }` y se llama
**dos veces por renglón**: una para el lado costo, una para el lado venta.
`apps/api/src/currency/conversion.service.ts:59-80` es el original de una sola vez.

`ConversionService` vive en `src/currency/currency.module.ts` y el módulo
**solo exporta `ConversionService`** en 2A. `RatesService`, `RatesController` y
`CurrencyService` son de 2B.

Reglas de `docs/travel/money.md`, sin excepción:

- Solo las columnas `*BaseAmount` se suman. Un `_sum` sobre `sellAmount` suma
  pesos con dólares y no avisa.
- La tasa se resuelve una vez y se congela, cuando cambia `amount` o `currency`.
- Una tasa faltante es `null`. Cuenta las filas nulas para que la UI lo diga.
- `margin = sellBaseAmount - costBaseAmount`. Es una lectura, no una columna.

---

## 5. Módulos de dominio de 2A

Forma rígida de cuatro archivos: `*.module.ts`, `*.router.ts`, `*.service.ts`,
`*.contracts.ts`. `apps/api/src/companies/` es el patrón exacto a copiar.

| Módulo | Alias tRPC | Entrega |
| --- | --- | --- |
| `agency` | `agency` | Perfil, `AgencySettings`, miembros, invitaciones, roles |
| `users` | `users` | Opciones de asesor **de esta agencia** |
| `customers` | `customers` | Lista, ficha, archivar, purgar, bulk |
| `quotes` | `quotes` | Cotización, `QuoteOption`, `QuoteItem`, folio, aceptar |
| `bookings` | `bookings` | Expediente, `BookingTraveler`, `BookingItem`, folio |

También se copian dos ayudantes compartidos, a `src/travel/`:

- `bulk.ts` de `apps/api/src/crm/bulk.ts` — `bulkIdsInput` con `MAX_BULK_IDS = 100`,
  `runBulk`, `requireOwner`.
- `values.ts` de `apps/api/src/crm/values.ts` — `blankToNull`, `normalizeEmail`,
  `toCents`, `fromCents`, `decimalFromCents`.

`ActivityStampService` se copia en 2B, junto con el módulo `activities`. En 2A
`Customer.lastActivityAt` y `Booking.lastActivityAt` quedan nulos.

### 5.1 Reglas del servicio

Cada método abre su propio cliente con alcance:

```ts
const scoped = agencyDb(this.db, agencyId);
```

Nunca toca `this.db` salvo para `ExchangeRate` y para `Organization`/`Member`,
que no son modelos tenant.

Cuatro filos del `agencyDb` actual que el servicio debe respetar
(`packages/travel-db/src/tenancy.ts`):

1. **Las escrituras anidadas no llevan alcance.** `pinAgencyId` solo toca el
   `data` de primer nivel. `booking.create({ data: { items: { create: [...] } } })`
   deja los hijos sin `agencyId` y falla el NOT NULL. Crea los hijos en llamadas
   aparte, dentro del mismo `$transaction`, cada una por `scoped`.
2. **`findUnique` lanza siempre.** `AgencySettings` tiene `agencyId` como llave
   primaria, así que la llamada natural es la que revienta. Usa `findFirst`.
3. **`$queryRaw` esquiva la extensión por completo.** `nextCounter` pasa
   `agencyId` a mano. Todo SQL crudo nuevo debe hacer lo mismo.
4. **Ninguna FK compuesta obliga a que el hijo sea de la misma agencia.** Cada
   `customerId`, `quoteId`, `supplierId` o `travelerId` que entra se relee por
   `scoped` antes de escribir. Si no aparece, `NotFoundException`. Es el RISK 1 de
   `docs/travel/status.md`.

Y las reglas heredadas de `docs/api.md`, sin cambio:

- **Los routers son delgados.** Zod entra, servicio sale. Prisma solo en
  `*.service.ts`.
- **Filtra, ordena y pagina en Prisma.** `listInput` entra, `{ rows, total,
  facetCounts }` sale.
- **Nunca interpoles `sort` en un nombre de campo.** Un mapa
  `SORTABLE: OrderByColumns<…>` a nivel de módulo y `resolveOrderBy`. Es la única
  vía.
- **Borrar es archivar primero y purgar después.** `archivedFilter(input.archived)`
  entra en todo `buildWhere` y en todo conteo de facetas.
- Los servicios lanzan excepciones de Nest. Un `private translate(cause, id): never`
  mapea `P2025` a `NotFoundException` y `P2002` a `ConflictException`.
  `DomainErrorMiddleware` traduce a códigos tRPC.
- **Nunca `console.log`.** `new Logger(Thing.name)`, un objeto por llamada, el
  stack como segundo argumento en los errores.
- **Nunca registres cabeceras, query strings ni cuerpos.**

### 5.2 Folios

`quotes.create` y `bookings.create` numeran dentro de la misma transacción:

```ts
const value = await nextCounter(tx, agencyId, COUNTER_KIND.quote);
const folio = formatFolio(settings.quotePrefix, new Date().getFullYear(), value);
```

`@@unique([agencyId, folio])` es la red. Un `P2002` ahí se reintenta una vez.

### 5.3 `agency` — el módulo con más reglas nuevas

- `agency.profile` / `agency.update` — `AgencySettings` por `findFirst`, escritura
  por `upsert`. Guarda `canManageAgency(ctx.role)`.
- `agency.members` — lista `Member` con su `User`. Devuelve el rol de cada uno.
- `agency.invite` — crea la `Invitation`, llama `sendAgencyInvitation`, y devuelve
  `{ id, email, url, delivered }`. Guarda `canManageMembers(ctx.role)`.
- `agency.setRole` / `agency.removeMember` — **el último `owner` no se degrada ni
  se quita.** `FOR UPDATE` sobre las filas `owner` antes de contar.
  `apps/api/src/workspace/workspace.service.ts` tiene ese invariante escrito.
- `users.list` — a diferencia del CRM, filtra por membresía:
  `where: { members: { some: { organizationId: agencyId } } }`.
  `apps/api/src/users/users.service.ts:16` lista a todos; aquí eso es una fuga.

### 5.4 Contratos

Nombres rígidos, porque la codegen los reimporta por nombre:
`<cosa>ListInput`, `<cosa>CreateInput`, `<cosa>UpdateArgs`, `<cosa>IdInput`,
`<cosa>RowOutput`, `<cosa>ListOutput`, `<cosa>DetailOutput`,
`<cosa>BulkResultOutput`. Se exportan entradas **y** salidas.

**Ningún esquema de entrada acepta `agencyId`.** Es la Regla 1 y hay una prueba
que la sostiene.

---

## 6. Pruebas

`bun:test`. Sin Jest, sin Vitest, sin archivo de configuración. Los specs viven
planos en `apps/travel-api/test/`, hermanos de `src/`, no colocados.

`test/setup.ts` — 7 líneas, un `afterAll` que hace `$disconnect()` de `@travel/db`.
`package.json`: `"test": "bun test --preload ./test/setup.ts"`.

Los specs de integración construyen el grafo de servicios **con `new`**, no con
un módulo de prueba de Nest. Por eso el orden de los argumentos del constructor
es carga útil. `apps/api/test/fields.spec.ts:1-70` es el modelo. Los nombres de
fixture salen de `process.env.TEST_RUN_ID`.

Cuatro specs mínimos:

1. **`test/agency-id-inputs.spec.ts`** — recorre cada esquema exportado de cada
   `*.contracts.ts` y afirma que ninguno acepta `agencyId`. Un solo archivo cubre
   la Regla 1 para todos los módulos, y sigue cubriéndola cuando llegue 2B.
2. **`test/tenancy.spec.ts`** (API) — dos agencias, dos usuarios. Cada
   procedimiento de lista devuelve solo lo propio. Leer por id un expediente ajeno
   da `NOT_FOUND`, no `FORBIDDEN`: un 403 confirma que la fila existe.
3. **`test/folio.spec.ts`** — dos agencias numeran en paralelo. Cada una lleva su
   propia serie. Ningún folio se repite.
4. **`test/agency-middleware.spec.ts`** — sin `activeOrganizationId` da
   `FORBIDDEN`. Con una agencia donde no hay `Member`, también.

**Amplía `packages/travel-db/test/tenancy.spec.ts`.** Los 6 casos actuales dejan
fuera cuatro ramas del `agencyDb`: `upsert` (la única que toca `next.create` y
`next.update`), `createMany` con arreglo (la recursión de `pinAgencyId`), el paso
libre de un modelo no tenant como `ExchangeRate`, y la escritura anidada.

---

## 7. Verificación

```sh
docker compose up -d
bun install
bun run travel:deploy
bun run travel:test
bun run --filter=@travel/db test
bun run --filter=travel-api test
bun run dev                       # crm 3000/3001, agent 2000, travel 3010/3011
curl localhost:3011/health
open localhost:3011                # Swagger, con el puente REST
```

Recorrido a mano, con dos cuentas:

1. Cuenta A crea agencia. Invita a un asesor. El asesor acepta.
2. Crea cliente. Cotiza con dos opciones, cada una con vuelo y hotel.
3. Verifica el folio: `COT-2026-0001`.
4. Acepta una opción. La reserva nace con `EXP-2026-0001`.
5. Cuenta B crea su propia agencia y cotiza. Su folio también es `COT-2026-0001`.
6. **Desde la cuenta B, llama `bookings.byId` con el id de la reserva de A.**
   Debe dar `NOT_FOUND`.

Antes de cada push:

```sh
bun run check-types && bun run lint && bun run lint:slop && bun run test
```

Los cuatro corren en CI y en `.githooks/pre-push`.

---

## 8. Archivos que cambian fuera de los paquetes nuevos

| Archivo | Cambio |
| --- | --- |
| `.env.example` | `TRAVEL_RESEND_API_KEY` en la sección `# Travel`, con nota |
| `turbo.json` | `TRAVEL_RESEND_API_KEY` en `globalPassThroughEnv` |
| `package.json` | Alias `travel:auth:generate` |
| `.oxlintrc.json` | Override de `packages/travel-validation/src/**` |
| `packages/travel-db/package.json` | Exports `./fx` y `./currency` |
| `packages/travel-db/test/tenancy.spec.ts` | 4 casos nuevos |

---

## Fase 2B — el resto, después

Módulos `travelers`, `suppliers`, `payments`, `activities`, `fields`,
`saved-views`, y `currency` completo (`RatesService`, `RatesController`,
`CurrencyService`, el cron de tasas en `vercel.json`).

Trae consigo: `ActivityStampService` de `apps/api/src/crm/`,
`@travel/db/src/fields.ts` y `fields-shape.ts`, `@travel/validation/saved-view`,
y un override de `apps/travel-api/src/fields/**` en `.oxlintrc.json` gemelo del
de la línea 63.

`OVERDUE` no es un estado guardado. Se deriva de
`status = SCHEDULED AND dueDate < now()`.

---

## Issues

1. RISK — `better-auth generate` borra las 18 relaciones inversas de
   `Organization` en `packages/travel-db/prisma/schema.prisma:103-137`. La
   tenencia deja de compilar.
   Fix: el flujo de tres pasos de 2.4, y un `README.md` en `@travel/auth` que lo
   diga. Revisar el diff a mano cada vez.
2. RISK — `agencyDb` no pone `agencyId` en escrituras anidadas. Un
   `booking.create` con `items: { create: [...] }` falla el NOT NULL.
   Fix: crear los hijos en llamadas aparte dentro del `$transaction`. La
   extensión no se cambia en 2A.
3. RISK — Ninguna FK compuesta obliga a que un hijo sea de la misma agencia. Un
   `customerId` ajeno se escribe sin queja.
   Fix: releer cada FK entrante por `agencyDb` antes de escribir. Es una
   convención, no una restricción de la base.
4. RISK — `formatFolio` recibe un año pero `AgencyCounter.value` nunca se
   reinicia. En enero de 2027 el folio dirá `COT-2027-0143`, no `COT-2027-0001`.
   Fix: no está hecho. Necesita el año dentro de la llave del contador.
5. RISK — `FieldValue` no tiene FK sobre `customerId`, `quoteId`, `bookingId`,
   `travelerId` ni `supplierId`. Borrar un cliente deja filas huérfanas.
   Fix: no está hecho. El servicio de 2B las limpia en la misma transacción.
6. RISK — `@crm/ui` depende de `@crm/db` por un solo import:
   `entity-logo.tsx:3` trae `isOptimizable` de `@crm/db/images`. El producto de
   viajes hereda el paquete de base de datos del CRM.
   Fix: no está hecho. Mover `images.ts` a `packages/ui/src/lib/` lo corta. Es de
   Fase 3.
7. RISK — `medicalNotes`, `dietaryNotes` y `documentNumber` guardan datos
   sensibles en claro.
   Fix: no está hecho. Cifrado en columna y política de retención, antes de la
   primera agencia real.
8. RISK — `ExchangeRate` es global. Un override `MANUAL` de una agencia afecta a
   todas.
   Fix: no está hecho. Si cada agencia necesita su tasa, agregar `agencyId` y
   unique compuesto.
9. NOT DONE — `apps/travel-api/scripts/build-func.mjs` apunta a `packages/db` y a
   un cron `/internal/sync/google` del CRM. Copiarlo sin editar migra la base
   equivocada en producción.
10. NOT DONE — `packages/travel-db` y `docs/travel/` no están en git. Un
    `git clean` borra la Fase 1 entera.
11. NOT DONE — Sin facturación fiscal (CFDI). Sin integración con GDS, mayoristas
    ni pasarelas de pago.
12. UNKNOWN — El país y la moneda base de la primera agencia. Decide el formato
    de los datos fiscales en `Customer` y `AgencySettings`.
