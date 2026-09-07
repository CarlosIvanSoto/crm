# Fase 9 — Auditoría de datos y semilla de demostración

## Contexto

`docs/travel/status.md` cerraba las fases 0 a 8B. El producto está completo: 17
routers, 136 procedimientos, 20 pantallas, el agente y el puente. Nada de eso
se veía funcionando, porque la base local no tenía datos que lo ejercieran.

La semilla (`packages/travel-db/prisma/seed.ts`) se escribió en la Fase 1 y
creció por parches. Ocho fases después estaba muy por detrás del esquema. Solo
hacía `create`, así que una segunda corrida fallaba con `P2002` y `travel:reset`
pedía consentimiento en una terminal interactiva. `status.md` repetía el mismo
pendiente desde la Fase 4A: «la base `travel` local no se resembró».

Reglas leídas: `AGENTS.md`, `docs/design.md`, `docs/travel/domain.md`,
`docs/travel/money.md`, `docs/travel/api.md`, `docs/travel/status.md`,
`docs/travel/plan_01.md`.

Resultado: `bun run travel:seed` deja una base donde cada pantalla muestra algo,
cada filtro tiene filas de los dos lados, y cada regla de dinero, rol y
vencimiento se ve en la interfaz sin tocar SQL.

## Auditoría de la base anterior

Medido el 2026-09-05 contra la base `travel` en Postgres 5433.

- **11 tablas vacías**: `exchangeRate`, `fieldDefinition`, `fieldOption`,
  `fieldValue`, `savedView`, `supplierPayment`, `travelerLoyalty`, `document`,
  `agentTask`, `agentConversation`, `invitation`.
- **El dinero no existía**: `sellBaseAmount` NULL en los 18 `quoteItem` y los 2
  `bookingItem`; `booking.sellTotalBase` NULL; `payment.baseAmount` NULL; 0
  filas en `exchangeRate`. El tablero suma `Booking.sellTotalBase`, así que
  «Sold this month» daba `$0` y `unconverted()` contaba todo.
- **Las ventanas de fecha estaban vacías**: `travelStartDate` NULL en las 2
  reservas; el único pago `SCHEDULED` vencía en el futuro; las fechas usaban
  `new Date(year, 0, 15)`, que cambia de significado cada enero.
- **Las facetas tenían un solo valor**: `role`, `quote.status`,
  `booking.status`, `supplier.kind`, `customer.type`, `activity.type` y
  `baseCurrency` cada una con un cubo.
- `quoteItem.details` NULL en las 18 filas; el `tokenHash` del único
  `quoteShare` venía de un token descartado; ninguna fila estaba archivada;
  `AgencySettings` sin `legalName`, `phone` ni `logoUrl`.

## Decisiones fijadas

| Decisión | Elección |
| --- | --- |
| Re-siembra | `travel:seed` borra primero. `organization.deleteMany` por slug barre el negocio por cascade; los usuarios se borran por la lista exacta de correos de la semilla; `exchangeRate` por `provider: "seed"` |
| Seguridad | `scripts/require-local-db.ts` ya corre antes de `travel:seed` y aborta si el host no es local. `ALLOW_REMOTE_DB=1` es el único camino, y es deliberado |
| Monedas | `andes-travel` base `USD`, `maya-tours` base `EUR`. Prueba que la base es por agencia |
| Tasas | Filas `FETCHED` para las dos bases, más un `MANUAL` sobre `USD→GBP`, para que `currency.settings` muestre `overriding: true` |
| Hueco a propósito | `JPY` se usa en renglones, pagos y una comisión, y **no** recibe fila `ExchangeRate`. `unconverted()` cuenta, la interfaz declara el faltante y nunca muestra cero |
| Montos base | Se calculan al insertar con `convertToBase` de `@travel/db/fx` — la misma función que usa la API. Sin segunda implementación |
| Totales | Espejo a mano de `itemBaseTotals` y de `freeze()` de comisiones: `null` si a un renglón le falta el monto base, nunca cero |
| Fechas | Todas relativas a `NOW`, con `daysFromNow()` |
| Documentos | Filas `Document` con el prefijo `agencies/<agencyId>/…` correcto. Sin token de blob, solo `downloadUrl` falla |
| Agente | Se siembra `AgentTask`. `AgentConversation` queda vacía: un `sessionId` inventado no tiene sesión eve detrás |
| Determinismo | `makeRandom(20260905 + índice·1009)` por agencia. Dos corridas dan la misma base y las mismas URLs `/q/<token>` |

## Estructura

`prisma/seed.ts` pasa a ser el orquestador; el resto vive en `prisma/seed/`.

```
prisma/seed.ts        main(): reset, rates, un ciclo por agencia, imprime enlaces
prisma/seed/random.ts     makeRandom, pick, chance, integer, sample, daysFromNow, tokenFromRng
prisma/seed/config.ts     AGENCIES — dos agencias, cinco usuarios cada una con rol
prisma/seed/context.ts    AgencyBag y los tipos de fila sembrada
prisma/seed/catalog.ts    nombres, destinos, y itineraryDetails() para los 9 tipos
prisma/seed/money.ts      withFx (sobrecargada), itemFx, itemBaseTotals
prisma/seed/reset.ts      resetSeedData()
prisma/seed/rates.ts      seedRates() — ExchangeRate, global, una sola vez
prisma/seed/agency.ts     Organization, User×5, Member, Account, Invitation, AgencySettings, AgencyCounter
prisma/seed/directory.ts  Supplier, Customer, Traveler, TravelerLoyalty
prisma/seed/quotes.ts     Quote, QuoteOption, QuoteItem — catálogo de 14 casos con etiqueta
prisma/seed/shares.ts     QuoteShare — 6 casos; imprime los tokens en claro
prisma/seed/bookings.ts   Booking, BookingTraveler, BookingItem — 10 casos con etiqueta
prisma/seed/finance.ts    Payment, SupplierPayment, Commission
prisma/seed/fields.ts     FieldDefinition, FieldOption, FieldValue, SavedView
prisma/seed/activities.ts Activity — timelines, tareas, SYSTEM, filas de recordatorio
prisma/seed/documents.ts  Document
prisma/seed/agent.ts      AgentTask
```

**Reutiliza:** `../src/fx` (`convertToBase`), `../src/currency`
(`normalizeCurrency`, `minorUnitsOf`), `../src/folio` (`formatFolio`),
`../src/fields-shape` (`fieldKeyFromLabel`, `columnFor`, `recordColumn`).
`@travel/validation` no se puede importar (ciclo con `@travel/db`); las nueve
formas de `details` se escriben a mano contra
`packages/travel-validation/src/itinerary-item.ts`.

## Lo que siembra

Por agencia, salvo `ExchangeRate` que es global. ~1300 filas en total, ~3 s de
corrida.

- **Usuarios**: `owner`, `admin`, `accountant`, 2 × `agent`, todos con `Account`
  de contraseña (`password123`). 1 `Invitation` `pending`.
- **`ExchangeRate`**: bases `USD` y `EUR` contra `EUR/GBP/CAD/AUD`/`USD/...`,
  `FETCHED`; un `MANUAL` sobre `USD→GBP`. Sin fila para `JPY`.
- **`AgencySettings`**: `legalName`, `taxId`, `phone`, `email`, `logoUrl`,
  `defaultTerms`, `timezone`. Prefijos `COT`/`EXP` y `CTZ`/`RES`.
- **Proveedores**: 12, uno por `SupplierKind`, 2 archivados.
- **Clientes**: 24 — 18 `PERSON`, 6 `COMPANY`, 3 archivados, 4 sin dueño,
  `lastActivityAt` escalonado.
- **Pasajeros**: 30, `documentType` `PASSPORT`/`ID`/`VISA` y algunos `null`.
  Uno con `documentExpiresAt` a +20 días sobre una reserva próxima. 8 con
  `TravelerLoyalty`.
- **Cotizaciones**: 14 sobre los 5 estados — una `DRAFT` sin opciones, una
  `SENT` con una opción sin precio (renglón en `JPY`), una `ACCEPTED` con
  reserva, una `ACCEPTED` por el enlace público con `acceptedOptionId` y
  `acceptedByName`, una `DECLINED`, una `EXPIRED`, una archivada, una sin dueño,
  una en moneda no base. Renglones de los 9 `ItineraryItemType` con `details`
  válido.
- **`QuoteShare`**: 6 — una viva sin ver, una vista (`viewCount: 4`,
  `firstViewAt` a −5 días), una revocada, una vencida, una sobre cotización con
  `validUntil` pasado, una sobre una `ACCEPTED`.
- **Reservas**: 10 sobre los 5 estados. `travelStartDate` a +3, +9, +28, +45
  (excluido) y una pasada. Una `TRAVELING` con salida pasada y regreso futuro.
  1, 2 y 5 pasajeros con `ADULT`/`CHILD`/`INFANT` y un solo `isLead`. Una con un
  renglón `JPY`, así que `sellTotalBase` es `null`.
- **Pagos**: ~4 `Payment` por reserva — anticipo `PAID` con método y referencia,
  saldo `SCHEDULED` futuro, uno vencido (`OVERDUE` derivado), uno `VOID`, uno en
  `JPY` (`baseAmount` null). Los 5 `PaymentMethod`.
- **Payables**: ~2 `SupplierPayment` por reserva, uno atado a un `bookingItemId`,
  uno vencido, uno pagado.
- **Comisiones**: 8 — las 3 bases × los 4 estados, entre 3 asesores. Una `FIXED`
  en `JPY` sin tasa (`amountBase` null). Una `MARGIN` sobre la reserva de total
  nulo (`basisBaseAmount` null). La `VOID` sale de `byAdvisor`.
- **Actividades**: ~58 — timelines en 3 clientes, 2 cotizaciones y 2 reservas
  con `NOTE`/`CALL`/`EMAIL`/`MEETING` y `occurredAt` escalonado; tareas en cada
  ventana (−5, −1, hoy, +3, +6, +20 días y una sin fecha), algunas completadas,
  entre 3 usuarios más una sin asignar, una con `reminderSentAt` reciente;
  `SYSTEM` para «Customer opened the quote link» y «… accepted the quote»; filas
  con los `sourceKey` reales de los cuatro barridos.
- **Campos**: 18 `FieldDefinition` sobre las 5 entidades, los 10 `FieldType`, dos
  `SELECT` con `showOnFilter`, uno `USER`, uno `required`, uno archivado, una
  opción archivada. `FieldValue` en ~70% de los registros.
- **Vistas**: 8 `SavedView`, compartidas del admin y privadas de agentes, con el
  centinela `unassigned` y una `archived: true`.
- **Documentos**: 22 sobre los 7 `DocumentKind`, anclados a reservas y a
  pasajeros, subidos por usuarios distintos.
- **`AgentTask`**: 5 — una abierta, una terminada con `outcome` y `sessionId`,
  una retirada (`attempts: 5`), una reclamable (`dueAt` en el pasado), una
  futura.

Los folios salen de un contador local; al final `AgencyCounter.value` se fija al
máximo sembrado por cada `kind`.

## Verificado

- `bun run check-types` — 23/23.
- `bun run lint` — 15/15. `bun run lint:slop` — pasa.
- `bun run --filter=@travel/db test` — 16 casos, sin cambio.
- `bun run --filter=travel-api test` — 259 casos, sin cambio.
- `bun prisma/seed.ts` dos veces seguidas — mismo resultado, mismas URLs.
- Contra Postgres 5433 tras sembrar: `quoteItem` sin base = 2 (las de `JPY`),
  `booking` sin total = 2, pagos `SCHEDULED` vencidos = 8, comisiones sin
  `amountBase` = 4. Todos a propósito.

## Pendiente

- El `next dev` real y el recorrido manual con los cinco roles no se ejecutaron
  en esta sesión. `check-types`, `lint`, `lint:slop` y las pruebas sí.
- `bun run --filter=travel-agent dispatch` con la tarea reclamable no se corrió.

## Issues

1. RISK — Sin `TRAVEL_BLOB_READ_WRITE_TOKEN`, `documents.downloadUrl` falla en
   toda fila sembrada. La lista, el renombrado y el borrado sí funcionan.
   Fix: no se hace. Es la misma capacidad retirada que define la Fase 7A.
2. RISK — La semilla borra antes de sembrar. Un desarrollador con datos propios
   en las agencias `andes-travel` o `maya-tours` los pierde.
   Fix: el borrado se acota a esos dos slugs y a la lista exacta de correos de
   la semilla. `require-local-db.ts` bloquea cualquier host remoto.
3. RISK — Las nueve formas de `details` se escriben a mano; `@travel/db` no
   puede importar `@travel/validation` sin un ciclo. Un cambio en el esquema Zod
   no rompe la semilla en compilación.
   Fix: el recorrido manual del itinerario es la única prueba. Una línea que
   diga «Detalle no legible» es el síntoma.
4. NOT DONE — `AgentConversation` queda vacía. La pestaña Agent de una
   cotización no lista nada hasta que una sesión eve real corra.
