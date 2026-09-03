# Fase 3 — `apps/travel-app`

## Contexto

El monorepo aloja un segundo producto para agencias de viajes. Las fases 0, 1,
2A y 2B están hechas. `apps/travel-api` expone **12 routers y 104
procedimientos**. Dos agencias operan de punta a punta y el aislamiento se mide
con 158 casos de prueba.

Falta la interfaz. Hoy el producto solo se opera con Swagger en `:3011`.

`apps/travel-app` no existe. `apps/app` (el CRM) tiene 295 archivos y 34,500
líneas. El equivalente de viajes son ~12,000 líneas: seis entidades de lista,
sus fichas, el tablero, los ajustes y el flujo de alta. Un diff así no se revisa.

Este plan corta la fase en tres rebanadas, igual que la Fase 2:

- **3A** — cableado, autenticación, shell y `customers` de punta a punta.
- **3B** — `travelers`, `suppliers`, `quotes`, `bookings`, `payments`.
- **3C** — tablero y ajustes. Incluye un módulo `dashboard` nuevo en la API.

Decisiones tomadas: rutas y textos en **inglés**; `record-stack.ts` se **copia**,
no se promueve; el tablero recibe un **módulo `dashboard` propio** en la API.

---

## Lo que ya existe. No lo vuelvas a agregar

| Archivo | Estado |
| --- | --- |
| `turbo.json:37-51` | 12 variables `TRAVEL_*` + `NEXT_PUBLIC_TRAVEL_API_URL` en `globalPassThroughEnv` |
| `knip.json` | Bloque de `apps/travel-app` ya declarado |
| `biome.jsonc` | Override de `apps/travel-app/**` con los dominios `next` y `react` |
| `.github/workflows/ci.yml` | Postgres 5433 y paso `travel:deploy` |
| `package.json` (raíz) | `workspaces: ["apps/*"]` registra el app nuevo sin editar nada |
| `docker-compose.yml` | `travel-postgres` en 5433 |
| `apps/travel-api` | 12 routers, `exports: { "./app-router": "./src/generated/server.ts" }` |
| `packages/travel-auth` | `./client` con `organizationClient()`, `./cookies`, `./agency` |

---

## Contratos que el app consume

`apps/travel-api/src/generated/server.ts` es la única fuente. Resumen operativo:

| Router | Procedimientos que el app usa en 3A/3B/3C |
| --- | --- |
| `users` | `me` → `{ id, name, email, image, agencyId, role }`; `list` |
| `agency` | `profile` → incluye **`slug`, `viewerRole`, `canManage`**; `updateProfile`, `members`, `invitations`, `invite`, `revokeInvitation`, `setRole`, `removeMember` |
| `customers` | `list`, `byId`, `options`, `create`, `update`, `archive`/`restore`/`purge`, `bulkAssignOwner`, `bulk*` |
| `travelers` | igual + `setLoyalty`. Sin `bulkAssignOwner` de dueño |
| `suppliers` | igual, **sin dueño ni faceta `owner`** |
| `quotes` | + `setOptions` (reemplaza el conjunto), `accept` → `{ quoteId, bookingId, bookingFolio }` |
| `bookings` | + `setItems`, `setTravelers` (ambos reemplazan el conjunto) |
| `payments` | `list` (cobros y cuentas por pagar), `add`/`record`/`void`/`remove` y sus gemelos `*Payable` |
| `fields` | `list`, `byKey`, `filters`, `coverage`, `values`, `create`, `update`, `reorder`, `setValues`, `archive`/`restore`/`delete` |
| `savedViews` | `list`, `create`, `update`, `delete` |
| `currency` | `settings`, `setBaseCurrency`, `setManualRate`, `removeManualRate`, `refreshRates` |
| `activities` | `timeline`, `timelineCounts`, `myTasks`, `create`, `complete` |

Tres hechos que cambian el código del app:

1. **`agency.profile` es el `workspace.get` de viajes.** Devuelve `slug`. El
   `proxy.ts` y el layout lo usan para resolver y validar la agencia de la URL.
2. **Los montos cruzan como `number` en unidades mayores**, no en centavos.
   `formatMoney` de `@crm/ui/lib/format.ts` divide entre 100 y da un resultado
   incorrecto. Ver 3A.5.
3. **`item.details` cruza como `z.unknown()`.** El cliente lo parsea con
   `readItineraryDetails` de `@travel/validation/itinerary-item`. Es la regla de
   `AGENTS.md`: parsea en la frontera.

---

## Promociones a `packages/ui` — antes de 3A

Dos archivos de `apps/app` son genéricos. Cada uno tiene un acoplamiento al CRM
que se rompe primero.

| Origen | Destino |
| --- | --- |
| `apps/app/components/data-table/list-search-params.ts` | `packages/ui/src/lib/list-search-params.ts` |
| `apps/app/components/data-table/use-table-query.ts` | `packages/ui/src/hooks/use-table-query.ts` |

**Acoplamiento 1 — `SavedViewFilters`.** `use-table-query.ts` lo importa de
`@crm/validation/saved-view`. Declara el tipo en
`packages/ui/src/lib/table-query.ts`:

```ts
export type SavedViewFilters = {
  q: string;
  sort: string;
  dir: SortDirection;
  archived: boolean;
  filters: Record<string, string[]>;
};
```

`packages/validation/src/saved-view.ts` y `packages/travel-validation/src/saved-view.ts`
infieren esa misma forma. Ninguno de los dos cambia.

**Acoplamiento 2 — `SEARCH_PARAM`.** `list-search-params.ts` importa
`assertUnreservedSearchParamKeys` de `@/lib/search-param-keys`. Ese archivo lleva
llaves del CRM (`closeDeal`, `closeStage`, `manageFields`). No se promueve.

En su lugar, `createListSearchParams` gana un campo opcional
`reserved?: ReadonlySet<string>` en `ListTableConfig`. Cada app envuelve la
función una vez y las seis llamadas del CRM no cambian:

```ts
// apps/app/components/data-table/list-search-params.ts
import { createListSearchParams as create } from "@crm/ui/lib/list-search-params";
import { RESERVED_SEARCH_PARAM_KEYS } from "@/lib/search-param-keys";

export function createListSearchParams<TTab extends string, TFacet extends string>(
  config: ListTableConfig<TTab, TFacet> = {},
) {
  return create({ ...config, reserved: RESERVED_SEARCH_PARAM_KEYS });
}
```

`packages/ui/package.json` mapea `./hooks/*` a `.ts` y `./lib/*` a `.ts`. Los dos
archivos son `.ts`. Resuelven sin tocar el mapa de exports.

**`record-stack.ts` no se promueve.** Fija `["company","contact","deal"]`, fija
`FORM_TAB` e importa `timelineTabParser` del timeline del CRM. 23 archivos del
CRM lo importan. Se copia a `apps/travel-app` con las clases de viajes. Se
promueve después, cuando ambos productos coincidan en la forma.

---

## Fase 3A — cableado, autenticación, shell y `customers`

Rebanada vertical. Al terminar, dos cuentas en dos agencias distintas usan la
app y la fuga entre ellas se mide desde el navegador.

### 3A.1 El app

```
apps/travel-app/
  package.json        name: "travel-app", "dev": "next dev --port 3010"
  next.config.ts      transpilePackages, serverExternalPackages
  postcss.config.mjs  export { default } from "@crm/ui/postcss.config";
  components.json     copia de apps/app, css → ../../packages/ui/src/styles/globals.css
  tsconfig.json       extiende @crm/typescript-config/nextjs.json, paths @/*
  turbo.json          extends ["//"], tarea typegen, passThroughEnv TRAVEL_*
  proxy.ts            la guarda de agencia
```

`package.json` depende de `@crm/ui`, `@crm/env`, `@crm/typescript-config`,
`@travel/auth`, `@travel/db`, `@travel/validation` y `travel-api`, más
`@tanstack/react-query`, `@trpc/*`, `better-auth`, `next`, `nuqs`, `sonner`,
`zod`, `@carbon/icons-react`.

`next.config.ts` copia el de `apps/app` con tres cambios:

```ts
const apiUrl = process.env.TRAVEL_API_URL
  ?? process.env.NEXT_PUBLIC_TRAVEL_API_URL
  ?? "http://localhost:3011";

env: { NEXT_PUBLIC_TRAVEL_API_URL: apiUrl },
transpilePackages: ["@crm/ui", "@travel/auth", "@travel/db"],
serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
```

`allowedDevOrigins` sale de `TRAVEL_APP_URL`.

**No importes `@crm/ui/components/entity-logo`.** Es el único archivo de
`packages/ui` que importa `@crm/db/images`. Usa `person-avatar.tsx`, que no tiene
dependencias. Así `@crm/db` queda fuera del grafo del app.

### 3A.2 Transporte

- `app/api/[...path]/route.ts` — copia literal de `apps/app`, con
  `TRAVEL_API_URL` como destino. Sirve `/api/trpc` **y** `/api/auth`, porque
  `authClient` de `@travel/auth/client` fija `baseURL` al origen del navegador.
- `lib/api-proxy-response.ts` — copia literal.
- `lib/env.ts` — `API_URL = process.env.NEXT_PUBLIC_TRAVEL_API_URL ?? "http://localhost:3011"`.
- `lib/trpc/{client.tsx,server.ts,hydrate.tsx,query-client.ts,types.ts}` — copia,
  con `import type { AppRouter } from "travel-api/app-router"`.

### 3A.3 Sesión y la guarda de agencia

`lib/session.ts`:

```ts
import { auth, type Session } from "@travel/auth";

export const getSession = cache(async (): Promise<Session | null> =>
  auth.api.getSession({ headers: await headers() }));

export async function requireSession(): Promise<Session> { … redirect("/sign-in") }
```

`lib/agency-gate.ts` — copia la forma de `apps/app/lib/onboarding.ts`. Lee
`agency.profile` sobre `${API_URL}/api/trpc` con la cookie reenviada, tiempo
límite de 2 segundos y Zod con `.catch()` en cada campo. Devuelve
`{ gate: "settled" | "required" | "unknown", slug }`. `required` significa que la
sesión no tiene agencia.

`proxy.ts`:

```ts
import { AUTH_COOKIE_PREFIX } from "@travel/auth/cookies";

const SIGN_IN_PATH = "/sign-in";
const NEW_AGENCY_PATH = "/new-agency";
const UNGATED = ["/sign-up", "/accept"];
const SECTIONS = ["/customers", "/travelers", "/suppliers", "/quotes",
                  "/bookings", "/payments", "/settings"];
```

Orden de las comprobaciones: rutas públicas pasan; sin cookie de sesión redirige
a `/sign-in`; rutas sin guarda pasan; después lee la agencia y redirige.
`agencyUrl(slug, path)` es la copia de `workspace-url.ts`.

**Un slug ajeno redirige al slug propio. No muestra nada.** El layout repite la
comprobación con `notFound()`, porque el proxy no es una autorización.

### 3A.4 Autenticación

Rutas nuevas en `app/(landing)/`:

| Ruta | Contenido |
| --- | --- |
| `sign-in/` | correo y contraseña, más Google cuando `isGoogleConfigured()` |
| `sign-up/` | `authClient.signUp.email()`, después `/new-agency` |
| `new-agency/` | `authClient.organization.create({ name, slug })` y `setActive()` |
| `accept/[invitationId]/` | `authClient.organization.acceptInvitation()` |

`components/auth-shell.tsx` y `auth-shader.tsx` se copian de `apps/app`.

**Un cambio obligatorio fuera del app.**
`packages/travel-auth/src/auth.ts` construye hoy
`new URL(\`/aceptar/${data.id}\`, env.appUrl)`. Con textos y rutas en inglés, esa
línea pasa a `/accept/${data.id}`. Sin ese cambio, el correo de invitación apunta
a una ruta que no existe.

**Regla de frontera.** Un archivo `"use client"` importa
`@travel/auth/client`, `@travel/auth/cookies` o `@travel/auth/agency`. **Nunca el
barril `@travel/auth`**: ese reexporta `auth.ts`, que alcanza Prisma, que alcanza
`pg`, que alcanza `dns`, y el build falla.

### 3A.5 Dinero en la interfaz

Los montos de viajes son `number` en unidades mayores. `formatMoney(cents)` de
`@crm/ui/lib/format.ts` divide entre 100.

Agrega a `packages/ui/src/lib/format.ts` una función aditiva. El CRM no cambia:

```ts
export function formatAmount(value: number, currency = "usd"): string
export function formatAmountCompact(value: number, currency = "usd"): string
```

Reusan `displayCurrencyCode` y `fractionDigits`, que ya existen en ese archivo.

**Solo se suman las columnas `*BaseAmount`.** Un total de la interfaz lee
`sellTotalBase`, `costTotalBase`, `marginBase` o `baseAmount`. Nunca `sellAmount`.

**Una tasa faltante se declara.** `bookings.byId` devuelve `unpricedItems` y
`payments.list` devuelve `totals.missingRate`. La interfaz muestra ese número
junto al total. Nunca lo trata como cero.

### 3A.6 Shell

Se copian de `apps/app` y divergen después:

`components/page-shell.tsx`, `page-transition.tsx`, `detail-sheet.tsx`,
`responsive-sheet.tsx`, `app-header.tsx`, `app-icon-rail.tsx`, `mobile-nav.tsx`,
`theme-provider.tsx`, `local-date-time.tsx`.

`app/layout.tsx` — línea 1 `import "@crm/ui/globals.css";`, después
`NuqsAdapter` → `TRPCReactProvider` → `ThemeProvider` → `TooltipProvider`, más
`Toaster`.

`app/(app)/[agency]/layout.tsx` — copia la forma del CRM. Carga `agency.profile`
en un componente suspendido y hace `notFound()` si `profile.slug !== agency`.

`app-icon-rail.tsx` cambia su tabla `ITEMS`:

```ts
Dashboard "/", Customers "/customers", Travelers "/travelers",
Quotes "/quotes", Bookings "/bookings", Suppliers "/suppliers",
Payments "/payments", Settings "/settings"
```

### 3A.7 Andamiaje de listas

- `lib/search-param-keys.ts` — copia con las llaves de viajes.
  `dialog` pierde `closeDeal` y `closeStage`.
- `components/data-table/list-search-params.ts` — el envoltorio de tres líneas
  descrito arriba.
- `components/data-table/list-search.tsx` y `saved-views-menu.tsx` — copia.
  `SavedViewsMenu` recibe `entity` de `FieldEntity` de viajes.
- `components/travel/record-sheet/record-stack.ts` — copia adaptada:
  ```ts
  const RECORD_KINDS = ["customer", "traveler", "supplier",
                        "quote", "booking"] as const;
  ```
  Sin `timelineTabParser` hasta que 3B agregue el timeline.
- `components/travel/record-sheet/{record-sheet-host,record-prefetch,record-parts,record-actions,record-link}` — copia.
- `components/travel/fields/*` — copia de `apps/app/components/crm/fields/`, sin
  `agentFilled` ni `agentBrief`. El módulo `fields` de viajes no los tiene.
- `components/travel/{owner-cell,bulk-actions,inline-field}.tsx` — copia.
- `lib/roles.ts` — reexporta `canManageAgency`, `canSeeMargins`,
  `canRecordPayment` de `@travel/auth/agency`. Ese archivo solo importa `Db` como
  tipo, así que el navegador lo acepta.

### 3A.8 `lib/trpc/cache.ts`

Se escribe entero. Es la fachada de invalidación del dominio de viajes:

```ts
export type TravelCache = {
  customer(id?, options?): Promise<void>;
  traveler(id?, options?): Promise<void>;
  supplier(id?, options?): Promise<void>;
  quote(id?, options?): Promise<void>;
  booking(id?, options?): Promise<void>;
  payment(bookingId?, options?): Promise<void>;
  activity(options?): Promise<void>;
  fields(entity?, options?): Promise<void>;
  savedViews(entity?, options?): Promise<void>;
  agency(options?): Promise<void>;
  currency(options?): Promise<void>;
  removed(record): Promise<void>;
  removedMany(records): Promise<void>;
  everything(): Promise<void>;
};
```

`apps/app/lib/trpc/cache.ts` es el patrón: el helper `run(record, rest, settle)`
espera las llaves del registro y dispara el resto. **Una mutación nueva agrega
una llamada aquí, no una lista de llaves en el sitio de uso.**

### 3A.9 `customers` de punta a punta

`app/(app)/[agency]/customers/` con la plantilla de cinco archivos:

| Archivo | Contenido |
| --- | --- |
| `page.tsx` | servidor. `requireSession()`, `load(searchParams)`, `prefetchQuery` de `customers.list` y `users.list`, `<HydrateClient>` |
| `customers-search-params.ts` | `createListSearchParams({ defaultSort: "createdAt", defaultDir: "desc", facetIds: ["type", "owner"] })` |
| `customers-table.tsx` | cliente. `COLUMNS` + `useTableQuery` + `DataTable` |
| `customers-bulk-actions.tsx` | `bulkAssignOwner`, `bulkArchive`, `bulkRestore`, `bulkPurge` |
| `create-customer-sheet.tsx` | `Sheet` con `type`, `name`, `email`, `phone`, `ownerId` |

Más `[customerId]/page.tsx`, que solo redirige a `?record=customer:<id>`, y
`components/travel/record-sheet/customer-sheet.tsx`.

Las facetas del API son `type` y `owner`. El sentinel de dueño es
`"unassigned"`.

---

## Fase 3B — el resto de las entidades

Cinco entidades sobre el andamiaje de 3A. En este orden, para que cada una se
pueda revisar sola:

1. **`suppliers`** — la más simple. Sin dueño, una sola faceta (`kind`).
2. **`travelers`** — facetas `customer` y `documentType`. La ficha agrega
   `setLoyalty`, que reemplaza el conjunto de programas.
3. **`quotes`** — la ficha lleva el **editor de opciones**.
4. **`bookings`** — la ficha lleva el **editor de itinerario**, los pasajeros y
   la pestaña de pagos.
5. **`payments`** — cobranza y cuentas por pagar en una sola pantalla.

### 3B.1 El editor de renglones — la pieza nueva

`quotes.setOptions` y `bookings.setItems` **reemplazan el conjunto completo**. El
editor guarda un borrador local del arreglo y envía todo. `SaveBar` de
`@crm/ui/components/save-bar` es el control.

`ItineraryItemInput` lleva dos lados de dinero y un `details` que es una unión
discriminada de **nueve ramas**:

| `type` | Campos de `details` |
| --- | --- |
| `FLIGHT` | `airline`, `flightNumber`, `cabin`, `departureAirport`, `arrivalAirport`, `baggage` |
| `HOTEL` | `hotelName`, `roomType`, `mealPlan`, `nights` |
| `TRANSFER` | `mode`, `vehicle`, `pickup`, `dropoff` |
| `TOUR` | `tourName`, `durationHours`, `guideLanguage`, `isPrivate` |
| `CRUISE` | `shipName`, `cabinCategory`, `nights` |
| `INSURANCE` | `planName`, `coverage`, `policyNumber` |
| `CAR_RENTAL` | `company`, `carClass`, `pickupLocation`, `dropoffLocation`, `transmission` |
| `PACKAGE` | `packageName`, `inclusions` |
| `OTHER` | `label`, `notes` |

`components/travel/itinerary/item-form.tsx` despacha por `type` a una rama.
`details.type` siempre iguala `item.type`; el API lo exige con un `superRefine`.

De lectura, `item.details` llega como `unknown`. Se parsea con
`readItineraryDetails`, que degrada a `UNREADABLE_DETAILS` en vez de tumbar la
lista. Un renglón ilegible se muestra como ilegible, no como vacío.

### 3B.2 Pasajeros de una reserva

`bookings.setTravelers` **crea filas `Traveler` en línea** y reemplaza el
conjunto. No es un selector sobre pasajeros existentes. La pestaña es un formulario
repetible con `firstName`, `lastName`, `paxType`, `isLead` y el documento.

### 3B.3 `payments`

Una lista con dos lados. `payments.list` acepta
`kind: "customer" | "supplier" | "all"` y devuelve `totals` en moneda base.

**`OVERDUE` no es un estado guardado.** El API lo deriva y lo devuelve en
`status`. El filtro entiende el valor derivado. La interfaz no lo calcula.

`canRecordPayment` (admin o contable) esconde los botones de mutación. El
servicio ya lanza; el predicado evita mostrar un control que da 403.

### 3B.4 Timeline

`components/travel/timeline/` se copia de `apps/app/components/crm/timeline/`
**sin** `email-thread-entry.tsx` ni `meeting-entry.tsx`. El modelo de viajes no
tiene hilos de correo ni eventos de calendario. Las anclas son `customerId`,
`quoteId` y `bookingId`.

Aquí `record-stack.ts` recupera su `timelineTabParser`.

---

## Fase 3C — tablero y ajustes

### 3C.1 Un módulo `dashboard` nuevo en `apps/travel-api`

El tablero no tiene fuente de datos. El CRM tiene `dashboard.summary`; viajes no
tiene ningún router equivalente. Agregar/tocar:

```
apps/travel-api/src/dashboard/
  dashboard.module.ts
  dashboard.router.ts      @UseMiddlewares(AuthMiddleware, AgencyMiddleware)
  dashboard.service.ts
  dashboard.contracts.ts
```

`summary({ scope: "me" | "everyone" })` devuelve, todo en moneda base:

| Campo | Origen |
| --- | --- |
| `soldBase` | `_sum` de `Booking.sellTotalBase` del mes en curso |
| `costBase` | `_sum` de `Booking.costTotalBase` del mes en curso |
| `marginBase` | `soldBase − costBase`. **`null` si `canSeeMargins` es falso** |
| `overdue` | `Payment` con `status = SCHEDULED AND dueDate < now()`: suma y conteo |
| `departures` | `Booking` con `travelStartDate` en los próximos 30 días |
| `unconverted` | conteo de filas con monto base nulo. Se declara, no se pone en cero |

Es agregación, no inteligencia. Respeta la regla de `AGENTS.md`: sin cliente de
proveedor, sin puntuación, sin enriquecimiento.

Cambios que arrastra: `app.module.ts` importa `DashboardModule`;
`src/generated/server.ts` se regenera y se commitea; `test/agency-id-inputs.spec.ts`
gana el módulo nuevo; un spec verifica que un rol `agent` recibe `marginBase: null`.

### 3C.2 El tablero

`app/(app)/[agency]/page.tsx` con `dashboard-summary.tsx`. Usa `StatCard`,
`DashboardGrid`, `DashboardRow` y `ChartCard` de `@crm/ui/components/dashboard`.
`overview-search-params.ts` lleva el parser de `scope`.

### 3C.3 Ajustes

`app/(app)/[agency]/settings/` con `layout.tsx` y `settings-sidebar.tsx`:

| Ruta | Procedimientos |
| --- | --- |
| `settings/` | `agency.profile`, `agency.updateProfile` — datos fiscales, zona horaria, logo |
| `settings/members/` | `agency.members`, `setRole`, `removeMember`, `invitations`, `invite`, `revokeInvitation` |
| `settings/currencies/` | `currency.settings`, `setBaseCurrency`, `setManualRate`, `removeManualRate`, `refreshRates` |
| `settings/fields/` | `fields.*` para las cinco entidades |
| `settings/folios/` | `agency.updateProfile` con `quotePrefix` y `bookingPrefix` |

`canManageAgency` esconde los controles de escritura en las cinco pantallas.

**`agency.invite` devuelve `{ url, delivered }`.** Cuando `delivered` es falso, la
pantalla muestra el enlace para copiar. Es el caso sin `TRAVEL_RESEND_API_KEY`, y
no es un error.

---

## Archivos que cambian fuera de `apps/travel-app`

| Archivo | Cambio | Rebanada |
| --- | --- | --- |
| `packages/ui/src/lib/table-query.ts` | `+ export type SavedViewFilters` | 3A |
| `packages/ui/src/lib/list-search-params.ts` | archivo nuevo, promovido, `+ reserved` en el config | 3A |
| `packages/ui/src/hooks/use-table-query.ts` | archivo nuevo, promovido | 3A |
| `packages/ui/src/lib/format.ts` | `+ formatAmount`, `+ formatAmountCompact` | 3A |
| `apps/app/components/data-table/list-search-params.ts` | pasa a envoltorio de 3 líneas | 3A |
| `apps/app/components/data-table/use-table-query.ts` | se borra; reexporta o se sustituye en 6 sitios | 3A |
| `packages/travel-auth/src/auth.ts` | `acceptUrl` pasa de `/aceptar/` a `/accept/` | 3A |
| `.env.example` | `NEXT_PUBLIC_TRAVEL_API_URL` con su nota | 3A |
| `apps/travel-api/src/app.module.ts` | `+ DashboardModule` | 3C |
| `apps/travel-api/src/generated/server.ts` | regenerado, 13 routers | 3C |
| `docs/travel/api.md` | sección del app: rutas, proxy, frontera cliente/servidor | 3C |
| `docs/travel/status.md` | Fase 3A/3B/3C a HECHO | cada una |

---

## Verificación

### Antes de cada push

```sh
bun run check-types && bun run lint && bun run lint:slop && bun run test
```

Los cuatro corren en CI y en el hook `pre-push`.

### Fase 3A

```sh
docker compose up -d
bun install
bun run travel:deploy && bun run travel:seed
bun run dev                    # crm 3000/3001, agent 2000, travel 3010/3011
open localhost:3010
```

Recorrido, con dos cuentas:

1. Regístrate. Crea la agencia "Alfa". Verifica que la URL es `/alfa`.
2. Crea un cliente. Ábrelo desde la tabla. Verifica la ficha.
3. Archívalo. Enciende el filtro "Archived". Verifica que aparece.
4. Invita a un asesor. Sin `TRAVEL_RESEND_API_KEY`, la pantalla da el enlace.
5. En la segunda cuenta, crea la agencia "Beta".
6. **Desde Beta, pega `/alfa/customers`. Debe redirigir a `/beta/customers`.**
7. **Desde Beta, pega `/beta/customers?record=customer:<id de Alfa>`.**
   La ficha debe decir "no encontrado". No debe mostrar el nombre.

El paso 7 es la prueba real. El paso 6 solo prueba el proxy.

### Fase 3B

8. Crea dos pasajeros con pasaporte y vigencia.
9. Cotiza con dos opciones. Cada una con vuelo, hotel y traslado.
10. Acepta una opción. Verifica que la reserva nace con folio consecutivo.
11. Registra un anticipo y dos parcialidades.
12. Marca la primera como pagada. Verifica el margen en moneda base.
13. Pon la fecha de una parcialidad en el pasado. Verifica que sale `OVERDUE`.
14. Deja un renglón sin precio. Verifica que el total declara el faltante.

### Fase 3C

```sh
bun run --filter=travel-api test
curl localhost:3011/health
```

15. El tablero muestra ventas del mes, margen, vencidos y salidas.
16. Con un usuario de rol `agent`, el margen no aparece y la respuesta trae
    `marginBase: null`.
17. Cambia la moneda base. Verifica que las filas ya convertidas no cambian.

---

## Issues

1. NOT DONE — `apps/travel-api` no tiene router `dashboard`. El tablero no tiene
   datos.
   Fix: módulo de 4 archivos en 3C. Ver 3C.1.
2. BROKEN — `packages/travel-auth/src/auth.ts:88` arma la URL de invitación como
   `/aceptar/${id}`. Con rutas en inglés, esa ruta no existe y la invitación no
   se acepta.
   Fix: cambia la línea a `/accept/${id}` en 3A.
3. RISK — `bookings.list` y `bookings.byId` devuelven `marginBase` a todo rol. El
   API no lo quita. Un rol `agent` lee el margen en la respuesta de red aunque la
   interfaz lo esconda.
   Fix: 3C.1 lo pone en `null` en el servicio del tablero. Los routers de
   `bookings` y `quotes` necesitan el mismo trato. No está hecho.
4. RISK — `travelers.list` devuelve `documentNumber` y `travelers.byId` devuelve
   `medicalNotes` y `dietaryNotes` en claro. La interfaz los muestra. Una captura
   de pantalla expone datos de pasaporte y de salud.
   Fix: no está hecho. Necesita cifrado en columna y enmascarado en la tabla,
   antes de la primera agencia real.
5. RISK — Promover `use-table-query.ts` y `list-search-params.ts` a `@crm/ui`
   acopla la tabla del CRM al paquete compartido. Un cambio para viajes rompe el
   CRM.
   Fix: los 6 sitios de uso del CRM quedan cubiertos por `bun run test` y
   `check-types`. La ruta de extracción ya contempla copiar `packages/ui`.
6. RISK — `packages/travel-auth` fija `activeOrganizationId` a la membresía más
   antigua al crear la sesión. Un usuario en dos agencias siempre entra a la
   primera.
   Fix: la pantalla de cambio de agencia llama
   `authClient.organization.setActive()`. No está en el alcance de 3A. El usuario
   con dos agencias no puede cambiar hasta 3C.
7. NOT DONE — No hay router `documents`. El modelo `Document` existe y
   `@vercel/blob` está instalado. No hay pantalla de adjuntos ni de vouchers.
8. NOT DONE — `activityFacetCounts` existe en `list-input.ts` pero ningún router
   lo expone. La faceta "Activity" del CRM no tiene equivalente en viajes.
9. RISK — 3B es la rebanada más grande: cinco entidades, el editor de itinerario
   de nueve ramas y el editor de opciones. Si el diff pasa de 5,000 líneas,
   córtala en 3B-1 (`suppliers`, `travelers`) y 3B-2 (`quotes`, `bookings`,
   `payments`).
10. UNKNOWN — El país y la moneda base de la primera agencia. `AgencySettings`
    fija hoy `USD` y `America/Mexico_City`. La pantalla de ajustes fiscales
    depende de esa respuesta.
