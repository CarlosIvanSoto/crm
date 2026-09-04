# Fase 4 — Rebanada 4A: datos y API de comisiones

## Contexto

El plan completo de la Fase 4 (solo comisiones) está en `docs/travel/plan_04.md`
y aprobado. Esta sesión implementa la **rebanada 4A**: el modelo `Commission`, el
módulo `commissions` de la API y el cierre del pendiente de margen de 3C. La
rebanada 4B (la app) es una sesión posterior.

Problema: la agencia sabe cuánto vendió y cuánto ganó. No sabe cuánto le debe a
cada asesor. `Booking.sellTotalBase` y `Booking.costTotalBase` dan el margen.
Falta la fila que congela la comisión y los reportes que la suman.

Reglas leídas: `AGENTS.md`, `docs/travel/domain.md`, `docs/travel/money.md`,
`docs/travel/api.md`. Skills: `nestjs-trpc`, `prisma-database-setup`.

Decisiones fijadas (de `plan_04.md`):

- Enum `CommissionBasis` = `MARGIN` | `SELL` | `FIXED`.
- El monto se congela al crear. `recalculate` explícito lo refresca.
- Solo `amountBase` se suma. Tasa faltante es `null`, nunca cero.
- Creación manual. Confirmar una reserva no crea la comisión.
- Comisión no es un `RecordKind`.

---

## 1. Esquema — `packages/travel-db/prisma/schema.prisma`

### 1.1 Enums nuevos

Justo encima del modelo `Commission` (después del bloque `SupplierPayment`,
antes de `enum RateSource` en la línea ~734):

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
```

### 1.2 Modelo `Commission`

Plantilla: `Payment` (`schema.prisma:667-696`). `rate` usa `Decimal(6, 4)`, igual
que `Supplier.defaultCommissionRate` (`schema.prisma:367`).

```prisma
model Commission {
  id       String       @id @default(cuid())
  agencyId String
  agency   Organization @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  bookingId String
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  userId    String
  user      User    @relation("CommissionEarner", fields: [userId], references: [id], onDelete: Restrict)

  basis CommissionBasis
  rate  Decimal? @db.Decimal(6, 4)

  basisBaseAmount Decimal?  @db.Decimal(24, 4)
  amount          Decimal?  @db.Decimal(14, 2)
  currency        String?
  amountBase      Decimal?  @db.Decimal(24, 4)
  baseCurrency    String?
  fxRate          Decimal?  @db.Decimal(20, 10)
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

### 1.3 Relaciones inversas (Prisma las exige)

| Modelo | Línea | Campo nuevo |
| --- | --- | --- |
| `Organization` | tras `supplierPayments` (~127) | `commissions Commission[]` |
| `Booking` | tras `activities` (571) | `commissions Commission[]` |
| `User` | tras `savedViews` (37) | `earnedCommissions Commission[] @relation("CommissionEarner")` |
| `User` | misma zona | `authoredCommissions Commission[] @relation("CommissionAuthor")` |

### 1.4 `AgencySettings` — valores por defecto del formulario

Tras `defaultTerms` (`schema.prisma:216`):

```prisma
  defaultCommissionBasis CommissionBasis?
  defaultCommissionRate  Decimal?         @db.Decimal(6, 4)
```

No son una regla que corre sola. Los usa el formulario de ajustes en 4B.

### 1.5 Tenencia — `packages/travel-db/src/tenancy.ts:17`

Agregar `"Commission"` a `TENANT_MODELS`, después de `"SupplierPayment"`. **Sin
esto el modelo queda sin alcance y una agencia lee las comisiones de otra.**

### 1.6 Migración

```sh
docker compose up -d
bun run --filter=@travel/db travel:migrate    # crea prisma/migrations/<ts>_commission
```

`bun run travel:auth:generate` **no se corre.** Solo `travel:migrate`.
Actualizar el aviso de `packages/travel-auth/README.md:43-59`: la lista de
relaciones inversas de `Organization`/`User` que el generador borra ahora
incluye las de comisión.

### 1.7 Barril

`packages/travel-db/src/index.ts` no cambia. `export * from
"./generated/prisma/enums"` recoge los enums nuevos, y el subpath
`@travel/db/enums` también.

---

## 2. Módulo `commissions` — `apps/travel-api/src/commissions/`

Forma de cuatro archivos. Plantilla más cercana: `suppliers/` (lista con facetas)
y `payments/` (dinero colgado de una reserva, ciclo de estado, guarda de rol).

### 2.1 `commissions.contracts.ts`

- Enums desde `@travel/db/enums`:
  `z.enum(Object.values(CommissionBasis) as [CommissionBasis, ...])`, igual con
  `CommissionStatus`.
- `commissionListInput = listInput.extend({ status: z.array(commissionStatus).default([]), basis: z.array(commissionBasis).default([]), userId: z.string().nullable().default(null), bookingId: z.string().nullable().default(null) })`.
  **Sin `archived`** — el estado terminal es `VOID`, no hay archivado.
- `createCommissionInput = z.object({ bookingId, userId, basis, rate: z.number().min(0).max(1).nullable().default(null), amount: z.number().positive().nullable().default(null), currency: currencyCode.nullable().default(null), note: z.string().trim().max(2000).nullable().default(null) })`
  con `.refine`: `basis === "FIXED"` exige `amount` y `currency`;
  `basis !== "FIXED"` exige `rate`.
- `updateCommissionInput = z.object({ id, rate?, amount?, note? })` (partial, sin
  cambiar `basis`, `bookingId` ni `userId`).
- `commissionIdInput = z.object({ id: z.string() })`. `recalculateInput = commissionIdInput`.
- `commissionBulkInput = bulkIdsInput` (de `../travel/bulk`).
- Salidas: `commissionRowOutput` (todos los campos como string/number, fechas
  `toISOString`), `commissionListOutput = { rows, total, facetCounts }`,
  `byBookingOutput = { rows, bookingMarginBase: z.number().nullable(), baseCurrency: z.string().nullable() }`,
  `commissionSummaryOutput = { id, status }`, `commissionDeleteOutput = { id }`,
  `advisorReportOutput = z.array({ userId, userName, commissions, commissionBase, missingRate, bookings, sellBase, marginBase })`,
  `supplierReportOutput = z.array({ supplierId, supplierName, items, costBase, sellBase, defaultRate })`,
  `commissionBulkResultOutput` (igual que `supplierBulkResultOutput`).
- **Ningún esquema de entrada tiene `agencyId` ni `userId` de sesión.** El
  `userId` de `createCommissionInput` es el asesor que gana, no el llamador.

### 2.2 `commissions.service.ts`

Imports como `payments.service.ts`: `ForbiddenException`, `Injectable`,
`Logger`, `NotFoundException`, `BadRequestException` de `@nestjs/common`;
`agencyDb, type Db, Prisma` de `@travel/db`;
`{ type AgencyRole, canManageCommission, canSeeMargins } from "@travel/auth"`;
`ConversionService`; `InjectDatabase`; `runBulk` de `../travel/bulk`;
`archivedFilter`-no, sino `countsByKey, type ListResult, type OrderByColumns, paginate, resolveOrderBy` de `../trpc/list-input`.

`private readonly logger = new Logger(CommissionsService.name)`.
`constructor(@InjectDatabase() private readonly db: Db, private readonly conversion: ConversionService)`.

Constante de módulo:

```ts
const SORTABLE: OrderByColumns<Prisma.CommissionOrderByWithRelationInput> = {
  createdAt: (dir) => ({ createdAt: dir }),
  status: (dir) => ({ status: dir }),
  amountBase: (dir) => ({ amountBase: { sort: dir, nulls: "last" } }),
};

function num(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}
```

Métodos (todos con `agencyId` de `ctx`, nunca input):

| Método | Firma | Nota |
| --- | --- | --- |
| `list` | `(agencyId, role, viewerId, input)` | `buildWhere` + `paginate` + `Promise.all([findMany, count, facetCounts])`. Si `!canSeeMargins(role)` fuerza `where.userId = viewerId`. Facetas `status` y `basis` por `groupBy` + `countsByKey` |
| `byBooking` | `(agencyId, role, viewerId, bookingId)` | Relee la reserva por `findFirst`. Filas de esa reserva; si `!canSeeMargins` limita a `userId = viewerId` y devuelve `bookingMarginBase: null` |
| `create` | `(agencyId, role, input)` | `requireManager`. Relee `booking` y `member(userId)` por el cliente con alcance. Llama `computeFrozen(...)`. Escribe la fila. Log |
| `update` | `(agencyId, role, input)` | `requireManager`. Solo si `status` es `PENDING` o `APPROVED`. Cambia `rate`/`amount`/`note`, recongela con `computeFrozen` |
| `approve` | `(agencyId, role, id)` | `requireManager`. `PENDING` → `APPROVED`, escribe `approvedAt` |
| `markPaid` | `(agencyId, role, id)` | `requireManager`. `APPROVED` → `PAID`, escribe `paidAt` |
| `voidCommission` | `(agencyId, role, id)` | `requireManager`. Cualquier estado → `VOID` |
| `remove` | `(agencyId, role, id)` | `requireManager`. Lanza si `status === "PAID"`. Copia `payments.service.ts:317-332` |
| `recalculate` | `(agencyId, role, id)` | `requireManager`. Relee la reserva, recongela. Lanza si `PAID`/`VOID` |
| `bulkApprove` / `bulkMarkPaid` | `(agencyId, role, ids)` | `runBulk(ids, (id) => this.approve(agencyId, role, id))` |
| `byAdvisor` | `(agencyId, role, viewerId)` | `groupBy(["userId"])` sobre `commission` con `_sum.amountBase` y `_count`. Une nombres por `member`. Suma `sellBase`/`marginBase` de `booking` por `ownerId` solo si `canSeeMargins`; para `agent` filtra a `viewerId` y omite margen |
| `bySupplier` | `(agencyId, role)` | `requireSeeMargins`. `groupBy(["supplierId"])` sobre `bookingItem` con `_sum` de `costBaseAmount`/`sellBaseAmount`. Une `supplier.name` y `supplier.defaultCommissionRate` |

Privados:

```ts
private requireManager(role: AgencyRole): void {
  if (!canManageCommission(role)) {
    throw new ForbiddenException(
      "Only an admin or an accountant can change commissions.",
    );
  }
}

private async computeFrozen(
  scoped: ReturnType<typeof agencyDb>,
  agencyId: string,
  bookingId: string,
  basis: CommissionBasis,
  rate: Prisma.Decimal | null,
  amount: Prisma.Decimal | null,
  currency: string | null,
): Promise<{
  basisBaseAmount: Prisma.Decimal | null;
  amount: Prisma.Decimal | null;
  currency: string | null;
  amountBase: Prisma.Decimal | null;
  baseCurrency: string | null;
  fxRate: Prisma.Decimal | null;
  fxRateAt: Date | null;
}>
```

- `MARGIN` / `SELL`: lee `booking.sellTotalBase`, `booking.costTotalBase`,
  `booking.baseCurrency` por `findFirst`. `basisBaseAmount` = `MARGIN`
  ? `sell.sub(cost)` : `sell`. Si el valor necesario es `null` →
  `basisBaseAmount = null` y `amountBase = null`. Si no,
  `amountBase = basisBaseAmount.times(rate).toDecimalPlaces(4)`.
  `fxRate = null`, `fxRateAt = null` (no hubo conversión). `amount`/`currency` =
  `null`. `baseCurrency` = `booking.baseCurrency`.
- `FIXED`: `amountDec = new Prisma.Decimal(amount.toFixed(2))`.
  `fx = await this.conversion.itemFields(agencyId, amountDec, currency)`.
  `amountBase = fx.baseAmount` (puede ser `null`). `basisBaseAmount = null`,
  `rate = null`. Devuelve `amount`, `currency`, y los campos `fx`.
  `itemFields` es de `apps/travel-api/src/currency/conversion.service.ts:82-100`.
- `translate(cause)`: `P2025` → `NotFoundException`. Copia
  `payments.service.ts:395-401`.

**Reglas del `agencyDb` que se respetan:**

- `agencyId` de `ctx`, nunca input.
- `findUnique` lanza. Toda lectura por id es `findFirst({ where: { id } })`.
- `bookingId` y `userId` entrantes se releen por el cliente con alcance antes de
  escribir (`payments.service.ts:384-393` es el patrón). Ningún FK compuesto lo
  garantiza.
- `Decimal` entra, `number` sale. Fechas `toISOString()`.
- `new Logger(...)`, un objeto por llamada. Nunca `console.log`.

### 2.3 `commissions.router.ts`

`@Router({ alias: "commissions" })`, `@UseMiddlewares(AuthMiddleware, AgencyMiddleware)`
a nivel de clase. `restMeta` con tag `["Commissions"]`. Rutas REST:
`POST /commissions/search` (list), `GET /commissions/booking/{bookingId}`
(byBooking), `POST /commissions` (create), `PATCH /commissions/{id}` (update),
`POST /commissions/{id}/approve`, `/{id}/pay`, `/{id}/void`,
`DELETE /commissions/{id}`, `POST /commissions/{id}/recalculate`,
`POST /commissions/bulk-approve`, `/bulk-pay`,
`GET /commissions/reports/advisors`, `GET /commissions/reports/suppliers`.

Cada método pasa `ctx.agencyId`, y `ctx.role` / `ctx.user.id` donde la firma del
servicio los pide. Router sin lógica.

### 2.4 `commissions.module.ts`

```ts
@Module({
  imports: [TrpcModule, CurrencyModule],
  providers: [CommissionsService, CommissionsRouter],
  exports: [CommissionsService],
})
export class CommissionsModule {}
```

---

## 3. Cerrar el pendiente de margen de 3C

`docs/travel/status.md:627`: `bookings` y `quotes` mandan `marginBase` a todo
rol. Una comisión con base `MARGIN` es dato de margen, así que 4A lo cierra.
Patrón: `dashboard.service.ts:105` — `canSeeMargins(role) ? … : null`.

| Archivo | Cambio |
| --- | --- |
| `bookings.service.ts` | `list(agencyId, role, input)` y `byId(agencyId, role, id)` ganan `role` como 2º parámetro. `marginBase` pasa a `canSeeMargins(role) ? sell - cost : null` en `:133` y `:236`. Import `canSeeMargins` |
| `bookings.router.ts` | `list` y `byId` pasan `ctx.role` |
| `quotes.service.ts` | `byId(agencyId, role, id)` gana `role`. La opción en `:226-229` pasa a `canSeeMargins(role) ? … : null`. Import `canSeeMargins` |
| `quotes.router.ts` | `byId` pasa `ctx.role` |
| `apps/travel-api/test/tenancy.spec.ts:80,83` | `bookings.byId(a.agencyId, "owner", booking.id)` — único sitio de prueba que llama estos métodos |

Los contratos (`bookings.contracts.ts:90`, `quotes.contracts.ts:128`) ya son
`z.number().nullable()`. No cambian.

---

## 4. Cableado y regeneración

| Archivo | Cambio |
| --- | --- |
| `apps/travel-api/src/app.module.ts` | `import { CommissionsModule }` y agregarlo a `imports`, después de `PaymentsModule` |
| `apps/travel-api/src/generated/server.ts` | `bun run --filter=travel-api trpc:generate`. Se commitea |
| `apps/travel-api/test/agency-id-inputs.spec.ts` | `import * as commissionContracts` + `...collect("commissions", commissionContracts)` en el arreglo |

`.env` y `turbo.json`: sin variables nuevas. `.oxlintrc.json`: sin override
nuevo — el módulo sigue el patrón de `payments/` y pasa `anti-slop`.

---

## 5. Semilla y pruebas de `@travel/db`

### 5.1 `packages/travel-db/prisma/seed.ts`

En el bloque `if (index === 1) { … }`, después del `db.payment.createMany`
(~línea 276), sin llamar `pick()` (no mover el PRNG):

```ts
await db.commission.createMany({
  data: [
    {
      agencyId,
      bookingId: booking.id,
      userId: ownerId,
      createdById: ownerId,
      basis: "MARGIN",
      rate: "0.1000",
      status: "PENDING",
    },
    {
      agencyId,
      bookingId: booking.id,
      userId: ownerId,
      createdById: ownerId,
      basis: "FIXED",
      amount: "150.00",
      currency: "USD",
      status: "APPROVED",
      approvedAt: new Date(),
    },
  ],
});
```

`basisBaseAmount` y `amountBase` quedan `null`: la semilla no tiene renglones
tasados ni filas `ExchangeRate`. Eso ejercita la ruta de "tasa faltante".
`agencySettings.create` (`seed.ts:116-118`) gana
`defaultCommissionBasis: "MARGIN", defaultCommissionRate: "0.1000"`.

### 5.2 `packages/travel-db/test/tenancy.spec.ts`

- `let commissionA` a nivel de módulo.
- `seedAgency(id)` crea una `commission` sobre su `booking` y la devuelve.
- `cleanup()` gana `await db.commission.deleteMany({ where: { agencyId: id } })`
  **antes** de `booking.deleteMany` (línea 77).
- Un `it` nuevo, estilo "create pins" (líneas 140-152):
  `agencyDb(db, agencyA).commission.findFirst({ where: { id: commissionB } })`
  devuelve `null`; `agencyDb(db, agencyA).commission.create({ data: { agencyId: agencyB, … } })`
  fija `agencyA`.

### 5.3 `apps/travel-api/test/helpers.ts`

`dropAgency` gana `await db.commission.deleteMany({ where: { agencyId } })` antes
de `db.bookingItem.deleteMany` (línea 57).

### 5.4 `apps/travel-api/test/commissions.spec.ts` (nuevo)

Estilo de `payments.spec.ts`: `new CommissionsService(db, new ConversionService(db))`,
`seedAgency("comm")`, un `booking` con `sellTotalBase`/`costTotalBase` puestos con
`new Prisma.Decimal(...)`.

1. Dos agencias. La agencia A no ve la comisión de B (`list` y `byBooking`).
2. Un `agent` recibe solo sus filas en `list` y en `byAdvisor`.
3. Un `agent` recibe `FORBIDDEN` en `create` y en `bySupplier`.
4. Base `MARGIN`: `amountBase` = `(sell - cost) * rate`. Cambiar
   `booking.sellTotalBase` después no mueve `amountBase`. `recalculate` sí.
5. Reserva sin `sellTotalBase`: `amountBase` es `null`. `list` cuenta
   `missingRate = 1`.
6. Base `FIXED` con `ExchangeRate` sembrado en otra moneda: `amountBase` sale de
   `itemFields`. Sin fila `ExchangeRate`: `amountBase` es `null`.
7. `remove` sobre una comisión `PAID` lanza.
8. `bookings.byId` con rol `agent` devuelve `marginBase: null`; con `owner`
   devuelve el número.

---

## 6. Verificación

```sh
docker compose up -d
bun run --filter=@travel/db travel:migrate      # aplica la migración
bun run --filter=@travel/db travel:seed
bun run travel:test                             # rebuild de travel_test con la migración
bun run --filter=@travel/db test                # tenancy.spec: caso de comisión
bun run --filter=travel-api test                # 164 → ~178 casos
bun run check-types
bun run lint
bun run lint:slop
curl localhost:3011/health
open localhost:3011                              # Swagger muestra el grupo "Commissions"
```

Arranque real: `bun run --filter=travel-api dev`, confirmar que
`/openapi.json` lista las rutas `/rest/commissions/*` y que
`src/generated/server.ts` tiene el router `commissions`.

---

## 7. Rebanada 4B — después (no en esta sesión)

Lista `app/(app)/[agency]/commissions/`, panel compartido en `booking-sheet.tsx`,
reportes by advisor / by supplier, tarjeta "Top advisors" en el tablero,
pantalla `settings/commissions/`, entrada en `app-icon-rail.tsx`, `/commissions`
en `proxy.ts`, `cache.commission()` en `lib/trpc/cache.ts`. Detalle en
`docs/travel/plan_04.md`.

Al cerrar 4A y 4B: escribir la sección "Comisiones" en `docs/travel/money.md`, el
router en `docs/travel/api.md`, y las secciones 4A/4B en `docs/travel/status.md`.

---

## Issues

1. RISK — `Commission` fuera de `TENANT_MODELS` fuga entre agencias.
   Fix: paso 1.5, con el caso de `tenancy.spec.ts` del paso 5.2.
2. BROKEN — `bookings.list`, `bookings.byId` y `quotes.byId` mandan `marginBase`
   a todo rol hoy.
   Fix: sección 3. Cierra el pendiente de `status.md:627`.
3. RISK — El monto congelado se desincroniza si cambia el itinerario de la
   reserva. Nada avisa en 4A.
   Fix: 4B marca la fila en la interfaz. `recalculate` ya existe en la API.
4. RISK — `ExchangeRate` es global. Una comisión `FIXED` en otra moneda usa una
   tasa que otra agencia sobrescribe con `MANUAL`.
   Fix: no está hecho. Riesgo 3 de `status.md:687`.
5. NOT DONE — Sin tasa de comisión por asesor. `AgencySettings` guarda una sola
   por agencia. Una tabla `CommissionRule` con `userId`/`supplierId` es trabajo
   posterior.
6. NOT DONE — Confirmar una reserva no crea la comisión. La creación es manual.
7. NOT DONE — `markPaid` cambia el estado. No escribe una fila de egreso al
   asesor.
