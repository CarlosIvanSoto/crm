# Fase 4 — Comisiones al asesor

## Contexto

El producto de viajes vive en este monorepo. Las fases 0 a 3C están hechas.
`apps/travel-api` expone 13 routers y 105 procedimientos. `apps/travel-app` tiene
el shell, seis entidades, el tablero y cinco pantallas de ajustes.

`docs/travel/plan_01.md:579-591` define la Fase 4 con cuatro piezas: comisiones,
tareas con cron, documento de cotización y `apps/travel-agent`. **Este plan cubre
solo las comisiones.** Las otras tres quedan fuera y se listan al final.

El problema que resuelve: hoy la agencia sabe cuánto vendió y cuánto ganó, pero
no sabe cuánto le debe a cada asesor. `Booking.sellTotalBase` y
`Booking.costTotalBase` ya dan el margen. Falta la fila que congela la comisión y
el reporte que la suma.

El entregable de esta sesión es **documentación, no código**: se escribe
`docs/travel/plan_04.md` y se actualiza `docs/travel/status.md`. La
implementación es una sesión posterior.

---

## Decisiones fijadas

| Decisión | Elección |
| --- | --- |
| Base de cálculo | Enum `CommissionBasis` = `MARGIN` \| `SELL` \| `FIXED` |
| Congelado | El monto se congela al crear. Nunca se recalcula al leer |
| Moneda | Solo `amountBase` + `baseCurrency` se suman |
| Tasa faltante | `amountBase` es `null` y se declara. Nunca cero |
| Creación | Manual. Confirmar una reserva no crea la comisión |
| Ficha de registro | No. Comisión no es un `RecordKind` |
| Rebanadas | 4A datos y API. 4B la app |

**Por qué el monto se congela.** `docs/travel/money.md:22-24` dice que la tasa se
resuelve una vez. Un margen que se recalcula cada mañana mueve la comisión de un
expediente cerrado. La fila guarda `basisBaseAmount` y `amountBase`. Una mutación
`recalculate` explícita los refresca.

**Por qué la creación es manual.** Una regla automática al confirmar es una
política. Una política dentro de la API es inteligencia, y `AGENTS.md` la
prohíbe. El asesor crea la fila; los valores por defecto salen de
`AgencySettings`.

**Por qué no es un `RecordKind`.** Agregar una quinta clase a
`components/travel/record-sheet/record-stack.ts:12-18` obliga a agregar una
entrada en `fields-entity.ts` y en el mapa `BY_ID` de `lib/trpc/cache.ts`, porque
los dos son `satisfies Record<RecordKind, …>`. Una comisión no tiene campos
personalizados. El panel dentro de la ficha de reserva basta.

---

## Rebanada 4A — datos y API

### 4A.1 Esquema

`packages/travel-db/prisma/schema.prisma`. El modelo `Payment` (:667-696) es la
plantilla exacta.

```prisma
enum CommissionBasis {
  MARGIN
  SELL
  FIXED
}

enum CommissionStatus {
  PENDING
  APPROVED
  PAID
  VOID
}

model Commission {
  id       String       @id @default(cuid())
  agencyId String
  agency   Organization @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  bookingId String
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  userId    String
  user      User    @relation("CommissionEarner", fields: [userId], references: [id], onDelete: Restrict)

  basis CommissionBasis
  rate  Decimal? @db.Decimal(7, 4)

  basisBaseAmount Decimal? @db.Decimal(24, 4)
  amount          Decimal? @db.Decimal(14, 2)
  currency        String?
  amountBase      Decimal? @db.Decimal(24, 4)
  baseCurrency    String?
  fxRate          Decimal? @db.Decimal(20, 10)
  fxRateAt        DateTime?

  status     CommissionStatus @default(PENDING)
  approvedAt DateTime?
  paidAt     DateTime?
  note       String?

  createdById String
  createdBy   User   @relation("CommissionAuthor", fields: [createdById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([agencyId])
  @@index([agencyId, status, createdAt])
  @@index([agencyId, userId, status])
  @@index([bookingId])
  @@map("commission")
}
```

Reglas de las columnas:

- `rate` es `null` cuando `basis = FIXED`. `amount` y `currency` son `null`
  cuando `basis` es `MARGIN` o `SELL`.
- `MARGIN` y `SELL` nacen en moneda base. `basisBaseAmount` es
  `sellTotalBase - costTotalBase` o `sellTotalBase`. `amountBase` es
  `basisBaseAmount * rate`. `fxRate` queda `null`: no hubo conversión.
- `FIXED` recibe `amount` y `currency` del asesor.
  `ConversionService.itemFields()` llena `amountBase`, `baseCurrency`, `fxRate` y
  `fxRateAt`, igual que `payments.service.ts:122-127`.
- **Solo `amountBase` se suma.** Es la regla de `docs/travel/money.md:16-20`.

Tres relaciones inversas nuevas en modelos existentes: `commissions
Commission[]` en `Booking`, y dos en `User` con los nombres
`"CommissionEarner"` y `"CommissionAuthor"`.

Cambios que acompañan al esquema:

| Archivo | Cambio |
| --- | --- |
| `packages/travel-db/src/tenancy.ts:3-24` | `+ "Commission"` en `TENANT_MODELS` |
| `packages/travel-db/prisma/migrations/` | Migración nueva por `bun run travel:migrate` |
| `packages/travel-db/prisma/seed.ts` | Comisiones en las dos agencias, una con tasa faltante |
| `packages/travel-db/test/tenancy.spec.ts` | Un caso de aislamiento sobre `commission` |

**Sin `Commission` en `TENANT_MODELS` el modelo queda sin alcance y una agencia
lee las comisiones de otra.** Es el paso de mayor riesgo de la rebanada.

`AgencySettings` gana dos columnas: `defaultCommissionBasis CommissionBasis?` y
`defaultCommissionRate Decimal? @db.Decimal(7, 4)`. Son los valores por defecto
del formulario, no una regla que corre sola.

### 4A.2 Predicados de rol

`packages/travel-auth/src/agency.ts` gana uno, junto a `canRecordPayment`
(:31-33):

```ts
export function canManageCommission(role: AgencyRole | null): boolean {
  return isAgencyAdmin(role) || role === "accountant";
}
```

Se exporta por el barril `src/index.ts`. El cliente lo importa por
`@travel/auth/agency`, que es un módulo hoja sin Prisma.

Reglas de acceso, impuestas en el servicio:

- **Ver.** Un rol con `canSeeMargins` ve todas las filas. Un `agent` ve solo las
  suyas. El filtro `userId = ctx.user.id` se aplica en el servicio; **nunca es un
  input**, igual que `agencyId`.
- **Escribir.** `canManageCommission` guarda `create`, `update`, `approve`,
  `markPaid`, `void`, `remove` y `recalculate`.
- **Reportes.** `bySupplier` exige `canSeeMargins`. `byAdvisor` devuelve solo la
  fila propia a un `agent`.

### 4A.3 Módulo `commissions`

`apps/travel-api/src/commissions/`, con la forma rígida de cuatro archivos.
`apps/travel-api/src/payments/` es la plantilla más cercana: filas de dinero
colgadas de una reserva, con ciclo de estado y guarda de rol.

| Archivo | Contenido |
| --- | --- |
| `commissions.module.ts` | `imports: [TrpcModule, CurrencyModule]`, igual que `payments.module.ts:8` |
| `commissions.router.ts` | `@Router({ alias: "commissions" })` + `@UseMiddlewares(AuthMiddleware, AgencyMiddleware)` a nivel de clase |
| `commissions.service.ts` | `agencyDb(this.db, agencyId)` por método. Prisma solo aquí |
| `commissions.contracts.ts` | Zod de entrada y de salida. Ningún esquema acepta `agencyId` |

Procedimientos:

| Procedimiento | Nota |
| --- | --- |
| `list` | `listInput.extend({ status, basis, userId, bookingId, archived: false })`. Facetas `status` y `basis` por `countsByKey` |
| `byBooking` | Filas de una reserva. Es lo que consume el panel de la ficha |
| `create` | Calcula y congela `basisBaseAmount` y `amountBase` |
| `update` | Solo `rate`, `note` y `amount`. Recalcula y vuelve a congelar |
| `approve` | `PENDING` → `APPROVED` |
| `markPaid` | `APPROVED` → `PAID`, escribe `paidAt` |
| `void` | Cualquier estado → `VOID` |
| `remove` | Solo si no está en `PAID`. Copia `payments.service.ts:317-332` |
| `recalculate` | Relee los totales de la reserva y refresca el monto congelado |
| `byAdvisor` | Suma por `userId`: comisión, reservas, venta y margen en moneda base |
| `bySupplier` | Suma `BookingItem.costBaseAmount` y `sellBaseAmount` por `supplierId`, con `Supplier.defaultCommissionRate` |

Reglas heredadas que el servicio cumple:

- `agencyId` sale de `ctx.agencyId`. Nunca de un input.
- La reserva entrante se relee con el cliente con alcance antes de escribir, como
  `payments.service.ts:384-393`. Ningún FK compuesto lo garantiza.
- `findUnique` lanza. Toda lectura por id usa `findFirst`.
- `Decimal` entra, `number` sale. Fechas salen como `toISOString()`.
- `new Logger(CommissionsService.name)`, un objeto por llamada. Nunca
  `console.log`.
- Los errores de Prisma se traducen con el helper `translate`, `P2025` a
  `NotFoundException`.

**Tasa faltante.** `Booking.sellTotalBase` es `null` cuando un renglón del
itinerario no tiene tasa (`bookings.service.ts:426-427`). Con base `MARGIN` o
`SELL` la comisión entonces no se puede calcular. La fila se crea igual, con
`amountBase: null`. `list` y `byAdvisor` devuelven un contador `missingRate`
junto al total. **Nunca se trata como cero.**

### 4A.4 Cerrar el pendiente de 3C

`bookings.service.ts:133` y `:236`, y `quotes.service.ts:226`, mandan
`marginBase` a todo rol. `docs/travel/status.md:627` lo marca pendiente. Una
comisión con base `MARGIN` es dato de margen, así que 4A lo cierra: los tres
sitios reciben `role` y devuelven `null` cuando `canSeeMargins` es falso, igual
que `dashboard.service.ts:105`.

### 4A.5 Cableado y pruebas

| Archivo | Cambio |
| --- | --- |
| `apps/travel-api/src/app.module.ts` | `+ CommissionsModule` |
| `apps/travel-api/src/generated/server.ts` | Regenerar con `bun run trpc:generate`. Se commitea |
| `apps/travel-api/test/agency-id-inputs.spec.ts` | `+ collect("commissions", commissionContracts)` |

`apps/travel-api/test/commissions.spec.ts`, casos mínimos:

1. Dos agencias. La agencia A no ve la comisión de B.
2. Un `agent` recibe solo sus propias filas en `list` y en `byAdvisor`.
3. Un `agent` recibe `FORBIDDEN` en `create` y en `bySupplier`.
4. Base `MARGIN` congela `basisBaseAmount`. Cambiar el itinerario después no
   mueve `amountBase`.
5. Reserva sin tasa: `amountBase` es `null` y `missingRate` es 1.
6. Base `FIXED` en otra moneda: `amountBase` sale de `itemFields()`.
7. `remove` sobre una comisión `PAID` lanza.

---

## Rebanada 4B — la app

`apps/travel-app`. Rutas y textos en inglés, como 3A a 3C.

### 4B.1 Pantalla de lista

`app/(app)/[agency]/commissions/`, con la plantilla de cinco archivos de
`app/(app)/[agency]/suppliers/`:

| Archivo | Nota |
| --- | --- |
| `page.tsx` | Servidor. `requireSession()` + `prefetchQuery` + `HydrateClient`, dentro de `<Suspense>` |
| `commissions-search-params.ts` | `createListSearchParams({ facetIds: ["status", "basis"] })` |
| `commissions-table.tsx` | Cliente. `COLUMNS` a nivel de módulo + `useTableQuery` |
| `commissions-bulk-actions.tsx` | Aprobar y marcar pagado en lote |
| `create-commission-sheet.tsx` | `<Sheet>` abierto por `?new=true` |

La tabla no abre ficha al hacer clic. Abre la ficha de la **reserva**, con
`openRecord({ kind: "booking", id: row.bookingId })` y `tab=commissions`.

### 4B.2 Panel compartido

`components/travel/commissions/commissions-panel.tsx`, con la forma de
`components/travel/payments/payments-panel.tsx`. Recibe props terminadas
(`bookingId`, `canManage`) y no deriva nada del servidor.

Se monta en una pestaña nueva de `record-sheet/booking-sheet.tsx`, en la lista
declarativa de `DetailSheetTabs`:

```tsx
{ value: "commissions", label: "Commissions", content: commissionsTab }
```

`canManage` sale de `trpc.users.me`, con `canManageCommission` de
`@travel/auth/agency`. **El botón y el 403 leen el mismo predicado.**

### 4B.3 Reportes

`app/(app)/[agency]/commissions/reports/page.tsx`, o una pestaña dentro de la
lista. Dos tablas `SimpleTable` dentro de un `DashboardRow split="even"`, con la
forma de `dashboard-summary.tsx:141-231`:

- **By advisor** — nombre, reservas, venta base, margen base, comisión base.
- **By supplier** — proveedor, renglones, costo base, venta base, tasa por
  defecto.

El tablero gana una tarjeta "Top advisors" en un `DashboardRow`, alimentada por
`commissions.byAdvisor`. `StatGroup` se queda con cuatro `StatCard`: el
componente fija `grid-cols-4` y una quinta tarjeta se envuelve mal.

### 4B.4 Ajustes

`app/(app)/[agency]/settings/commissions/` con `page.tsx` y
`commissions-form.tsx`. Escribe `defaultCommissionBasis` y
`defaultCommissionRate` por `agency.updateProfile`. Se registra con un renglón en
el arreglo `ITEMS` de `settings/settings-sidebar.tsx:17-23`, que alimenta las
tres vistas de la barra.

### 4B.5 Cableado del app

| Archivo | Cambio |
| --- | --- |
| `components/app-icon-rail.tsx:32-53` | `+ { title: "Commissions", href: "/commissions", icon: Wallet, match: "prefix" }` |
| `proxy.ts:13-21` | `+ "/commissions"` en `SECTIONS` |
| `lib/trpc/cache.ts` | `+ commission(bookingId?)`, con la forma de `payment` (:154-164) |
| `lib/trpc/cache.ts:142-152` | `booking()` también invalida `trpc.commissions.list` |
| `components/travel/status-labels.ts` | Etiquetas y variante de badge de `CommissionStatus` |

`lib/trpc/cache.ts` no toca `RecordKind` ni `BY_ID`: la comisión no es una ficha.

---

## Documentos

Se escriben al cerrar cada rebanada, no antes.

| Archivo | Cambio |
| --- | --- |
| `docs/travel/money.md` | Sección "Comisiones": las tres bases, el congelado, la tasa faltante |
| `docs/travel/api.md` | El router `commissions` y el predicado `canManageCommission` en la lista de roles |
| `docs/travel/status.md` | Fase 4A y 4B, con archivos, decisiones, verificado y pendientes |
| `docs/travel/plan_04.md` | Este plan, en la forma de `plan_02.md` y `plan_03.md` |

---

## Verificación

**4A**

```sh
docker compose up -d
bun run travel:migrate
bun run travel:seed
bun run travel:test
bun run --filter=@travel/db test
bun run --filter=travel-api test
curl localhost:3011/health
open localhost:3011
```

`bun run --filter=travel-api test` debe pasar de 164 a más de 175 casos. Swagger
debe mostrar el grupo `Commissions`.

**4B**

```sh
bun run dev
open localhost:3010
```

Recorrido con dos cuentas en dos agencias:

1. Como `owner`, abre una reserva con margen y crea una comisión base `MARGIN`.
2. Verifica que el monto queda en moneda base.
3. Cambia el itinerario. El monto de la comisión no se mueve.
4. Corre `recalculate`. Ahora sí se mueve.
5. Crea una comisión base `FIXED` en otra moneda. Verifica la conversión.
6. Quita la tasa de una moneda. La lista declara el faltante, no un cero.
7. Entra con un `agent`. Ve solo sus comisiones. No ve los botones de aprobar.
8. Desde la segunda agencia, pega la URL de la comisión ajena. No debe mostrar
   nada.

**Antes de cada push**

```sh
bun run check-types && bun run lint && bun run lint:slop && bun run test
```

---

## Fuera de alcance

Las otras tres piezas de la Fase 4 en `plan_01.md:579-591` no entran aquí.
Cada una necesita su propio plan.

- **Tareas y recordatorios.** El modelo `Activity` ya tiene `TASK`, `dueAt` y
  `completedAt`. La API ya expone `activities.myTasks` y `activities.complete`.
  Falta la interfaz y un cron de recordatorios.
- **Documento de cotización.** Enlace público y PDF.
- **`apps/travel-agent`.** El agente eve propio.

---

## Issues

1. RISK — `Commission` fuera de `TENANT_MODELS` queda sin alcance. Una agencia
   lee las comisiones de otra.
   Fix: agregar `"Commission"` en `packages/travel-db/src/tenancy.ts:3-24`, con
   un caso en `tenancy.spec.ts`.
2. BROKEN — `bookings.list`, `bookings.byId` y `quotes.byId` mandan `marginBase`
   a todo rol. Un `agent` ve el margen en la red.
   Fix: 4A.4 pasa `role` a los tres servicios y devuelve `null` sin
   `canSeeMargins`.
3. RISK — El monto de la comisión se congela. Un cambio de itinerario deja la
   comisión desactualizada y nada avisa.
   Fix: la interfaz marca la fila cuando `basisBaseAmount` no coincide con el
   margen actual. `recalculate` es manual.
4. RISK — `ExchangeRate` es global. Una comisión `FIXED` en otra moneda usa una
   tasa que otra agencia puede sobrescribir con `MANUAL`.
   Fix: no está hecho. Es el riesgo 3 de `status.md:687`.
5. NOT DONE — No hay tasa de comisión por asesor. `AgencySettings` guarda una
   sola por agencia.
   Fix: necesita una tabla `CommissionRule` con `userId` y `supplierId`.
6. NOT DONE — Confirmar una reserva no crea la comisión. La creación es manual.
7. NOT DONE — No hay pago de comisiones al asesor. `markPaid` cambia el estado,
   pero no escribe una fila de egreso.
8. UNKNOWN — Si la comisión se calcula antes o después de impuestos. Decide si
   `basisBaseAmount` necesita una columna de retención.
9. UNKNOWN — Si una reserva puede repartir comisión entre dos asesores. El
   modelo lo permite; ninguna regla lo limita.
