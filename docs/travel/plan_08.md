# Fase 6 — Documento de cotización

## Contexto

`docs/travel/status.md` cierra las fases 0 a 5B. `apps/travel-api` tiene 14
routers. `apps/travel-app` tiene el shell, las seis entidades, el tablero,
comisiones, la bandeja de tareas y los ajustes.

`docs/travel/plan_01.md:579-591` define cuatro piezas después de la base sólida.
Tres están hechas: comisiones (`plan_04.md`), tareas y recordatorios
(`plan_07.md`). Faltan dos: el **documento de cotización** y `apps/travel-agent`.
Esta fase cubre solo el documento de cotización. El agente queda fuera y
necesita su propio plan.

Problema: el asesor arma una cotización con dos o tres opciones y no tiene cómo
mostrarla al cliente. La cotización vive dentro de la app, detrás de la sesión.
El cliente no la ve, no la imprime y no la acepta. Hoy el asesor copia los datos
a mano en un correo.

Resultado: el asesor genera un enlace público `/q/<token>`. El cliente abre la
propuesta sin cuenta, la imprime a PDF con el navegador, elige una opción y la
acepta. La cotización pasa a `ACCEPTED` y guarda la opción elegida. El asesor
crea la reserva después con `quotes.accept`, que ya existe.

Reglas leídas: `AGENTS.md`, `docs/design.md`, `docs/travel/domain.md`,
`docs/travel/money.md`, `docs/travel/api.md`, `docs/travel/status.md`.

## Decisiones fijadas

| Decisión | Elección |
| --- | --- |
| Modelo | `QuoteShare` nuevo, no columnas en `Quote` |
| Token | 32 bytes `base64url`. Se guarda `sha256` en `tokenHash` |
| Resolución | Lectura cruzada deliberada con el cliente crudo, por `tokenHash` |
| Transporte | Router tRPC `publicQuote`, **sin `AuthMiddleware`** |
| PDF | Hoja de impresión del navegador. Cero dependencias nuevas |
| Aceptación | El cliente elige opción y acepta. **No crea la reserva** |
| Correo | `quotes.send` por Resend. Sin llave, devuelve el enlace y no lanza |
| Costos | La salida pública **no tiene** `cost*` ni `margin*`. Ni un campo |

La fase se corta en dos rebanadas, igual que las fases 3, 4 y 5:

- **6A** — datos y API.
- **6B** — la app: página pública, pestaña Share, impresión.

---

# 6A — Datos y API

## 1. Esquema — `packages/travel-db/prisma/schema.prisma`

### 1.1 Modelo `QuoteShare`

Va después del bloque `QuoteItem`, antes de `model Booking`.

```prisma
model QuoteShare {
  id       String       @id @default(cuid())
  agencyId String
  agency   Organization @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  quoteId String
  quote   Quote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  tokenHash String @unique

  expiresAt   DateTime?
  revokedAt   DateTime?
  firstViewAt DateTime?
  lastViewAt  DateTime?
  viewCount   Int       @default(0)

  createdById String
  createdBy   User   @relation("QuoteShareAuthor", fields: [createdById], references: [id])

  createdAt DateTime @default(now())

  @@index([agencyId])
  @@index([quoteId])
  @@map("quoteShare")
}
```

`tokenHash` es `@unique` global. Esa es la llave de la ruta pública.

### 1.2 Campos nuevos en `Quote`

Después de `terms` (`schema.prisma:422`):

```prisma
  acceptedOptionId String?
  acceptedByName   String?
```

`decidedAt` ya existe y sella la hora. `acceptedOptionId` es la opción que
eligió el cliente. `acceptedByName` es el nombre que el cliente escribió. No es
una firma legal; es trazabilidad.

### 1.3 Relaciones inversas

| Modelo | Campo nuevo |
| --- | --- |
| `Organization` | `quoteShares QuoteShare[]` |
| `Quote` | `shares QuoteShare[]` |
| `User` | `authoredQuoteShares QuoteShare[] @relation("QuoteShareAuthor")` |

### 1.4 Tenencia — `packages/travel-db/src/tenancy.ts`

Agregar `"QuoteShare"` a `TENANT_MODELS`, después de `"QuoteItem"`. **Sin esto
una agencia lee los enlaces de otra.**

### 1.5 Migración

`prisma migrate dev` no corre sin TTY en esta sesión. La vía es la de la Fase 5A:

```sh
docker compose up -d
bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma \
  --script > prisma/migrations/<ts>_quote_share/migration.sql
bun run --filter=@travel/db travel:deploy
```

(Prisma 7's CLI dropped `--from-schema-datasource`/`--to-schema-datamodel` in
favor of `--from-config-datasource` read off `prisma.config.ts`. `plan_07.md`'s
command is stale the same way.)

`bun run travel:auth:generate` **no se corre.** El generador borra las
relaciones inversas de `Organization` y `User`. Actualizar el aviso de
`packages/travel-auth/README.md` con la relación nueva.

## 2. Módulo `quote-share` — `apps/travel-api/src/quote-share/`

Cinco archivos. Un módulo con **dos routers**: uno autenticado, uno público.

```
quote-share.contracts.ts
quote-share.service.ts
quote-share.router.ts        alias "quoteShare"  — AuthMiddleware + AgencyMiddleware
public-quote.router.ts       alias "publicQuote" — SIN middleware de auth
quote-mailer.ts              Resend opcional, nunca lanza
quote-share.module.ts
```

### 2.1 `quote-share.contracts.ts`

Entradas autenticadas: `shareQuoteIdInput = { quoteId }` (nombre distinto de
`quotes.contracts.ts`'s `quoteIdInput` — el generador de tRPC desambigua por
nombre, no por módulo, y dos exports con el mismo nombre pisan uno al otro en
`generated/server.ts` sin avisar), `createShareInput = { quoteId, expiresInDays: z.number().int().min(1).max(365).nullable().default(null) }`,
`sendQuoteInput = { quoteId, to: z.string().trim().email().nullable().default(null), message: z.string().trim().max(2000).nullable().default(null) }`.

Entradas públicas: `publicTokenInput = { token: z.string().min(20).max(200) }`,
`publicAcceptInput = { token, optionId: z.string(), name: z.string().trim().min(2).max(120) }`.

Salidas:

- `shareStatusOutput = { enabled, url: string | null, createdAt, expiresAt, firstViewAt, lastViewAt, viewCount }`.
  `url` solo sale en `create`; en `status` sale `null` — **el token en claro no
  se guarda y no se puede releer**.
- `sendQuoteOutput = { delivered: boolean, url: string, to: string | null }`.
  Copia la forma de `agency.invite`.
- `publicQuoteOutput` — la lista blanca. Campos:
  `agency { name, legalName, logoUrl, phone, email }`,
  `quote { folio, destination, travelStartDate, travelEndDate, paxAdults, paxChildren, paxInfants, validUntil, notes, terms, status, acceptedOptionId, expired: boolean, canAccept: boolean }`,
  `customer { name }`,
  `options[] { id, label, isRecommended, sellTotalBase, baseCurrency, priced: boolean, items[] { type, description, startsAt, endsAt, paxCount, position, sellAmount, sellCurrency, details } }`.
- `publicAcceptOutput = { folio, optionId, acceptedAt }`.

**Ningún campo `cost*`, `margin*`, `ownerId`, `customerId`, `userId` ni `id` de
la agencia sale en la salida pública.** Una prueba lo sostiene (5.2).

### 2.2 `quote-share.service.ts`

Plantilla: `apps/api/src/conversations/conversation-sharing.service.ts` para el
token, `payments.service.ts` para la forma del servicio de viajes.

```ts
import { createHash, randomBytes } from "node:crypto";
```

`shareTokenHash(token)` es `createHash("sha256").update(token).digest("hex")`,
copia de `apps/api/src/conversations/conversation-share-token.ts`.

| Método | Firma | Nota |
| --- | --- | --- |
| `status` | `(agencyId, quoteId)` | `findFirst` del share vivo. `url: null` |
| `create` | `(agencyId, userId, input)` | Revoca los shares vivos y crea uno. Devuelve `url` una sola vez |
| `revoke` | `(agencyId, quoteId)` | `updateMany` con `revokedAt` |
| `send` | `(agencyId, userId, input)` | Revoca el share vivo y crea uno nuevo (el `tokenHash` no es reversible, así que "reusar" un share es imposible; siempre se emite un token fresco). `to ?? customer.email`. Estampa `sentAt` y pasa a `SENT` si el estado es `DRAFT`. Llama `sendQuoteLink` |
| `view` | `(token)` | Resuelve, cuenta la vista, arma la salida pública |
| `accept` | `(token, optionId, name)` | Resuelve, valida, escribe |

Privado `resolve(token)`:

```ts
const share = await this.db.quoteShare.findFirst({
  where: {
    tokenHash: shareTokenHash(token),
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    quote: { archivedAt: null },
  },
  select: { id: true, agencyId: true, quoteId: true, createdById: true },
});
if (!share) throw new NotFoundException("That link is not valid.");
```

**Esta es la única lectura del cliente crudo fuera de un cron.** `agencyDb` no
sirve: el llamador anónimo no tiene agencia. El `agencyId` sale de la fila, y
todo lo demás corre por `agencyDb(this.db, share.agencyId)`. La regla de
`docs/travel/domain.md` se mantiene: `agencyId` nunca entra por el input.

`view` incrementa con `updateMany({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastViewAt: new Date() } })`
y fija `firstViewAt` solo si es `null`. En la primera vista escribe una
`Activity` `SYSTEM` anclada a la cotización, con
`createdById = share.createdById`. El cliente anónimo no tiene `User`.

`accept` valida en orden y con mensajes distintos:

1. `quote.status` es `ACCEPTED` y `acceptedOptionId === optionId` → devuelve el
   mismo resultado. Aceptar dos veces no es un error.
2. `quote.status` no es `DRAFT` ni `SENT` → `ConflictException`
   ("That quote is already decided.").
3. `validUntil` pasada → `BadRequestException` ("That quote expired.").
4. La opción no es de esa cotización → `NotFoundException`.
5. Escribe en una transacción: `status: "ACCEPTED"`, `decidedAt`,
   `acceptedOptionId`, `acceptedByName`, y una `Activity` `SYSTEM`. Sigue el
   patrón de `quotes.service.ts`'s `accept`: `this.db.$transaction(async (tx) =>
   {...})` con `agencyId` explícito en cada `where`, no `agencyDb` dentro de la
   transacción — la extensión no se propaga a `tx`.

**No crea la reserva.** `quotes.accept` sigue siendo del asesor y ya no choca:
su guarda mira `quote.booking`, no el estado (`quotes.service.ts:509`).

### 2.3 `quote-share.router.ts` — autenticado

`@Router({ alias: "quoteShare" })` con
`@UseMiddlewares(AuthMiddleware, AgencyMiddleware)` a nivel de clase. Rutas
REST: `GET /quotes/{quoteId}/share`, `POST /quotes/{quoteId}/share`,
`DELETE /quotes/{quoteId}/share`, `POST /quotes/{quoteId}/send`.

### 2.4 `public-quote.router.ts` — anónimo

`@Router({ alias: "publicQuote" })` **sin `@UseMiddlewares`**. Dos
procedimientos: `view` (query) y `accept` (mutation). REST:
`GET /public/quotes/{token}` y `POST /public/quotes/{token}/accept`.

Los middlewares globales (`LoggingMiddleware`, `DomainErrorMiddleware`) siguen
corriendo: están en `TRPCModule.forRoot`. El router no lee `ctx.user` ni
`ctx.agencyId`; el tipo del contexto es `TrpcContext` base, no `AgencyTrpcContext`.

**Este es el único router público del producto.** `docs/travel/api.md` dice "sin
middleware, el procedimiento es público". Aquí es intencional y el contrato de
salida es la guarda.

### 2.5 `quote-mailer.ts`

Copia literal de `apps/travel-api/src/activities/reminder-mailer.ts`. Lee
`TRAVEL_RESEND_API_KEY` y `TRAVEL_QUOTE_FROM`. Sin las dos devuelve
`{ configured: false, delivered: false }` y no lanza. El enlace se arma con
`appUrl` de `@travel/auth`: `${appUrl}/q/${token}`.

## 3. Variable nueva

| Archivo | Cambio |
| --- | --- |
| `.env.example` | `# TRAVEL_QUOTE_FROM=""` en la sección Travel, con la nota de que reusa `TRAVEL_RESEND_API_KEY` |
| `turbo.json` | `TRAVEL_QUOTE_FROM` en `globalPassThroughEnv` |
| `apps/travel-api/turbo.json` | igual |
| `apps/travel-api/src/config/env.validation.ts` | `@IsOptional() @IsString() TRAVEL_QUOTE_FROM?: string` |

## 4. Cableado

| Archivo | Cambio |
| --- | --- |
| `apps/travel-api/src/app.module.ts` | `+ QuoteShareModule`, después de `QuotesModule` |
| `apps/travel-api/src/generated/server.ts` | `bun run --filter=travel-api trpc:generate`. Se commitea: 16 routers |
| `apps/travel-api/test/agency-id-inputs.spec.ts` | `+ quoteShareContracts` en la lista |
| `apps/travel-api/test/helpers.ts` | `dropAgency` borra `quoteShare` antes de `quote` |
| `packages/travel-db/prisma/seed.ts` | Un `QuoteShare` por agencia sobre la cotización sembrada |

## 5. Pruebas

### 5.1 `packages/travel-db/test/tenancy.spec.ts`

Un caso más: `agencyDb(db, agencyA).quoteShare.findFirst({ where: { id: shareB } })`
devuelve `null`, y `create` con `agencyId: agencyB` fija `agencyA`. `cleanup`
borra `quoteShare` antes de `quote`. Pasa de 12 a 13 casos.

### 5.2 `apps/travel-api/test/quote-share.spec.ts` (nuevo)

Estilo `payments.spec.ts`, dos agencias:

1. El token de la agencia B resuelve la cotización de B y nunca datos de A.
2. Un token revocado, uno vencido y uno inventado dan `NOT_FOUND`. Los tres con
   el mismo mensaje: el enlace no dice por qué falló.
3. `view` no trae ninguna llave que empate `/cost|margin|ownerId|customerId/`.
   La prueba recorre el JSON, no una lista escrita a mano.
4. `view` incrementa `viewCount` y escribe una sola `Activity` en la primera
   vista.
5. `accept` fija `status`, `decidedAt`, `acceptedOptionId` y `acceptedByName`.
6. `accept` dos veces con la misma opción devuelve lo mismo y no duplica la
   `Activity`.
7. `accept` con una opción de otra cotización da `NOT_FOUND`.
8. `accept` sobre una cotización con `validUntil` pasada da `BAD_REQUEST`.
9. Después de `accept` público, `quotes.accept` del asesor sí crea la reserva.
10. `send` sin `TRAVEL_RESEND_API_KEY` devuelve `delivered: false` y una `url`.
    No lanza.

---

# 6B — La app

## 1. Hoja de impresión — `packages/ui`

`packages/ui/src/styles/print.css`, exportada como `"./print.css"` en
`packages/ui/package.json`. Es la única vía correcta: `/packages/ui` es la
fuente de verdad de la interfaz, y una hoja suelta en `apps/travel-app` sería
una desviación visual local.

Define `@page { margin: 16mm }`, oculta `[data-print="hide"]`, evita el corte
dentro de `[data-print="keep"]`, y fija los tokens de tema claro. La página no
inventa radios, colores ni espaciados: usa la escala de `docs/design.md`.

## 2. Página pública — `apps/travel-app/app/(public)/q/[token]/`

```
layout.tsx        importa "@crm/ui/print.css". Sin header, sin rail, sin sesión
page.tsx          servidor. Prefetch + hydrate de publicQuote.view. notFound() si falla
quote-document.tsx   "use client". useQuery sobre la cache hidratada, arma la propuesta
option-card.tsx      presentacional, sin "use client" propio (no usa hooks)
itinerary-lines.tsx  presentacional. Lee details con readItineraryDetails
accept-panel.tsx     "use client". Elegir opción, escribir nombre, aceptar
print-button.tsx     "use client". window.print(). data-print="hide"
```

Reglas que la página respeta:

- **La página de servidor calcula, el componente cliente renderiza — en la
  forma que ya usa el resto de `apps/travel-app`.** `page.tsx` hace
  `queryClient.fetchQuery(trpc.publicQuote.view.queryOptions({ token }))` dentro
  de un `try/catch` que llama `notFound()` (el patrón de
  `[agency]/layout.tsx`'s `loadAgency`), y entrega el resultado hidratado vía
  `HydrateClient`. `quote-document.tsx` lee esa cache con `useQuery`, el mismo
  contrato que cada ficha de registro (`quote-sheet.tsx` incluido) — no recibe
  los datos como props planas de un padre servidor, los lee de la query
  hidratada. Ningún archivo de esta carpeta importa `@travel/db` ni
  `@travel/auth`.
- El export `instant = false` en `page.tsx` es obligatorio: sin él, Next
  rechaza el build porque `params`/`fetchQuery` corren fuera de un límite
  `<Suspense>` en una ruta que de otro modo intentaría prerenderizarse.
- `readItineraryDetails` de `@travel/validation/itinerary-item` degrada un
  renglón ilegible. Un `details` roto no tumba la propuesta.
- **El total va en moneda base**, con `formatAmount` de `@crm/ui/lib/format`.
  Solo `sellTotalBase` se suma (`docs/travel/money.md`). Cada renglón muestra su
  `sellAmount` en su propia moneda.
- **Una opción sin precio dice "Price on request".** Nunca cero.
- `metadata` con `robots: { index: false, follow: false }`. La propuesta no se
  indexa.
- `accept-panel` usa `useTRPC()` y `publicQuote.accept`. Al aceptar, invalida el
  `useQuery` de `quote-document.tsx` (`refetch()`), que vuelve a pintar con
  `canAccept: false` y la opción marcada.

## 3. Pestaña Share en la ficha de cotización

`apps/travel-app/components/travel/record-sheet/quote-sheet.tsx` gana una
cuarta pestaña, después de `options` y antes de `timeline`:

```
{ value: "share", label: "Share", content: shareTab }
```

`components/travel/quotes/share-panel.tsx` (cliente) muestra:

- El estado del enlace: creado, vencido, vistas, última vista.
- **Create link** y **Revoke link**. Sin predicado nuevo: todo miembro que ve la
  cotización la comparte. `AgencyMiddleware` es la guarda.
- El campo de solo lectura con la URL y el botón **Copy**, igual que
  `members-screen.tsx:203-213`. La URL se muestra **una sola vez**, al crear.
  Después el panel dice "The link exists. Revoke it and create a new one to see
  it again."
- **Send to customer**: campo de correo vacío (con placeholder "usa el correo
  del cliente si se deja en blanco") y un mensaje — `quotes.byId` no expone el
  correo del cliente a la ficha, así que no hay valor que precargar; el
  servicio ya cae a `customer.email` cuando `to` es `null`. Sin Resend, el
  resultado es el enlace copiable y un aviso, no un error.

## 4. Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `apps/travel-app/proxy.ts` | `+ "/q"` en `PUBLIC` |
| `apps/travel-app/lib/trpc/cache.ts` | `quote(id)` invalida `quoteShare.status` |
| `apps/travel-app/lib/search-param-keys.ts` | sin cambio: la pestaña usa `record.tab` |
| `packages/ui/package.json` | `+ "./print.css"` en `exports` |

## 5. Limpieza pendiente de fases anteriores

`docs/travel/plan_05.md` — el duplicado de `plan_04.md` que `status.md` issue 9
señalaba — ya no está en el árbol de trabajo al empezar esta fase. Nunca se
había comiteado (`status.md` ya decía "sin seguimiento en git"), así que no hay
nada que borrar.

---

## Documentación al cerrar

| Archivo | Cambio |
| --- | --- |
| `docs/travel/plan_08.md` | Este plan, en el repositorio, como los anteriores |
| `docs/travel/api.md` | Sección del router `quoteShare` y del router público. La excepción de lectura cruzada por token |
| `docs/travel/domain.md` | El párrafo del cliente crudo: resolver un token es la segunda excepción, junto a `ExchangeRate` |
| `docs/travel/status.md` | Fases 6A y 6B, con archivos, decisiones, verificado y pendientes |
| `.env.example` | `TRAVEL_QUOTE_FROM` |

## Verificación

```sh
docker compose up -d
bun run --filter=@travel/db travel:deploy
bun run travel:test
bun run --filter=@travel/db test          # 12 → 13 casos
bun run --filter=travel-api test          # 213 → 223 casos
bun run check-types                       # 22/22
bun run lint && bun run lint:slop
bun run --filter=travel-app build         # sin "Module not found: dns"
```

Recorrido manual, dos cuentas en dos agencias:

1. Crear una cotización con dos opciones. Marcar una como recomendada.
2. Pestaña Share → Create link. Copiar la URL.
3. Abrir la URL en una ventana privada, **sin sesión**. La propuesta carga.
4. Imprimir a PDF. El encabezado, las opciones y los términos entran completos.
   Los botones no salen en el papel.
5. Buscar `cost` y `margin` en la respuesta de red de `/api/trpc/publicQuote.view`.
   Cero coincidencias.
6. Elegir una opción, escribir un nombre y aceptar. La cotización pasa a
   `ACCEPTED` y guarda la opción.
7. En la app, la ficha muestra la vista del cliente y la opción aceptada.
   `quotes.accept` crea la reserva con folio.
8. Revoke link. La misma URL da "not found".
9. Desde la segunda agencia, abrir el enlace de la primera. La propuesta carga:
   **es un enlace público, esa es su función.** Pegar el `quoteId` en la app de
   la segunda agencia sigue dando "no encontrado".

## Issues

1. RISK — El router `publicQuote` no tiene límite de peticiones. Un atacante
   prueba tokens en serie.
   Fix: no está en 6A. El token de 32 bytes hace la prueba inviable, pero un
   límite por IP en el proxy queda pendiente.
2. RISK — `view` escribe en cada carga anónima (`viewCount`). Un robot infla el
   contador.
   Fix: no está hecho. `robots: noindex` reduce el caso, no lo cierra.
3. RISK — La lectura por `tokenHash` usa el cliente crudo. Un error ahí lee
   entre agencias.
   Fix: la prueba 5.2.1 la cubre. El `agencyId` sale de la fila, nunca del input.
4. NOT DONE — El cliente no puede rechazar la cotización desde el enlace. Solo
   acepta.
5. NOT DONE — No hay PDF del servidor. El archivo sale de la impresión del
   navegador y depende del navegador del cliente.
6. NOT DONE — `apps/travel-agent` sigue fuera. Necesita un modelo tipo
   `AgentTask` en `packages/travel-db` y su propio plan.
7. NOT DONE — El modelo `Document` sigue sin módulo. Subir pasaporte, voucher o
   factura no existe.
8. UNKNOWN — Si el cliente debe ver los precios por renglón o solo el total de
   la opción. El plan muestra los dos.
