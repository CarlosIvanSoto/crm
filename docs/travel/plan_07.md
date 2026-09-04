# Fase 5 — Tareas y recordatorios

## Contexto

El monorepo aloja un segundo producto para agencias de viajes. Las fases 0 a 4B
están hechas. `apps/travel-api` expone 14 routers y 118 procedimientos.
`apps/travel-app` tiene el shell, seis entidades, el tablero, comisiones y seis
pantallas de ajustes.

`docs/travel/plan_01.md:579-591` define la Fase 4 con cuatro piezas: comisiones
(hecho en `plan_04.md`), tareas con cron, documento de cotización y
`apps/travel-agent`. **Este plan cubre solo tareas y recordatorios.** El
documento de cotización y `apps/travel-agent` quedan fuera y se listan al final.
Cada uno necesita su propio plan.

El problema que resuelve: el módulo `activities` ya existe y funciona. Nadie lo
ve. `apps/travel-app` no renderiza una sola actividad. Y `activities.myTasks`
filtra por `createdById`. "Mis tareas" significa "las que yo escribí". Una
agencia con cuatro asesores no reparte pendientes.

La fase se corta en dos rebanadas, igual que la Fase 3 y la Fase 4:

- **5A — datos y API.** La columna `assignedToId` en `Activity`, la bandeja de
  tareas en el router `activities`, y el barrido de recordatorios con su cron.
- **5B — la app.** El timeline en las fichas, la bandeja de tareas y la tarjeta
  del tablero.

---

## Lo que ya existe. No lo vuelvas a agregar

| Archivo | Estado |
| --- | --- |
| `apps/travel-api/src/activities/` | Módulo de 4 archivos, 5 procedimientos: `timeline`, `timelineCounts`, `myTasks`, `create`, `complete` |
| `apps/travel-api/src/activities/activities.service.ts:185-212` | `myTasks` ya filtra `type: TASK`, `completedAt: null`, con ventanas `overdue`/`upcoming`/`all` |
| `apps/travel-api/src/currency/rates.controller.ts` | El patrón exacto del cron: `@AllowAnonymous()`, `timingSafeEquals`, 503 sin secreto |
| `apps/travel-api/src/currency/currency-config.ts` | La forma de un `*-config.ts` de área |
| `apps/travel-api/src/dashboard/dashboard.service.ts:46-70` | El `where` de "pago vencido" y de "salida próxima". Se reusa tal cual |
| `apps/travel-api/src/trpc/list-input.ts` | `listInput`, `paginate`, `resolveOrderBy`, `countsByKey`, `ownerFilter`, `FACET_UNASSIGNED` |
| `packages/travel-auth/src/invitations.ts` | El patrón de correo opcional: `{ delivered: boolean }`, `fetch` a Resend, `catch` sin binding |
| `apps/travel-api/src/config/env.validation.ts:64-69` | `TRAVEL_CRON_SECRET` ya existe y ya se valida (mínimo 16) |
| `apps/travel-api/src/activities/activities.module.ts` | Ya exporta `ActivitiesService`. Solo gana `controllers` |
| `apps/app/components/crm/timeline/` | La interfaz de timeline completa: 7 archivos. Se porta |
| `apps/travel-app/lib/trpc/cache.ts:66-70,189-191` | `activityKeys()` y `cache.activity()` ya cableados. Nada los usa aún |
| `apps/travel-app/app/(app)/[agency]/commissions/` | La plantilla de 5 archivos de una entidad de lista |
| `packages/travel-db/src/tenancy.ts` | `Activity` ya está en `TENANT_MODELS`. **No cambia** |

---

## Decisiones fijadas

| Decisión | Elección |
| --- | --- |
| Asignación | `Activity.assignedToId` nuevo. Con migración |
| Asignado por defecto | El autor. La migración copia `createdById` a las filas existentes |
| Alcance de lectura | Admin ve todo. `agent` ve solo lo asignado a él |
| Recordatorio | En la app siempre. Correo por Resend, opcional. Falla abierto |
| Disparadores | Tres: tarea vencida, pago vencido, salida próxima |
| Idempotencia del barrido | Restricción única `@@unique([agencyId, sourceKey])`. No una consulta |
| Modelo del recordatorio | Una fila `Activity` de tipo `TASK`. No un modelo nuevo |
| Rebanadas | 5A datos y API. 5B la app |

**Por qué `assignedToId` es una columna, no `meta`.** Un filtro y un índice
necesitan una columna. `Activity.meta Json?` no se indexa y no se valida. La
bandeja consulta "tareas de este asesor, sin cerrar, ordenadas por vencimiento".
Eso es un índice compuesto.

**Por qué el asignado por defecto es el autor.** Crear una tarea sin escoger a
nadie no cambia de significado: la escribo para mí. La migración fija
`assignedToId = createdById` donde `type = 'TASK'`. Sin ese `UPDATE`, toda tarea
existente queda sin dueño y desaparece de la bandeja.

**Por qué `agent` ve solo lo suyo.** Es la misma regla que comisiones. El filtro
`assignedToId = ctx.user.id` lo pone el servicio para un rol sin `canSeeMargins`;
**nunca es un input**, igual que `agencyId`. No hace falta un predicado nuevo en
`@travel/auth`: `canSeeMargins` (admin o contable) ya separa "ve todo" de "ve lo
suyo".

**Por qué el barrido escribe filas `Activity`.** Un recordatorio de pago vencido
es un pendiente accionable. La tabla que guarda pendientes ya existe. Un modelo
nuevo duplica el ciclo `completedAt` y la interfaz.

**Por qué la idempotencia es una restricción, no una consulta.** `sourceKey
String?` con `@@unique([agencyId, sourceKey])`. Postgres trata cada `NULL` como
distinto, así que las tareas que escribe un humano (con `sourceKey` nulo) no
chocan. `createMany({ skipDuplicates: true })` vuelve el barrido idempotente sin
un `SELECT` previo. Sin esto, el barrido escribe la misma tarea cada mañana.

**Por qué el endpoint falla cerrado y el correo falla abierto.** El gate del
cron copia `rates.controller.ts:65-76`: sin `TRAVEL_CRON_SECRET` responde 503 y
no corre. El envío copia `invitations.ts:18-23,46-49`: sin llave devuelve
`delivered: false` y no lanza. Son dos defectos opuestos a propósito. El endpoint
es una frontera de autorización. El correo es un canal lateral. Un
autohospedado sin Resend recibe la tarea en la app; no recibe el correo.

**Por qué un recordatorio de tarea no crea una fila.** La tarea ya existe: un
humano la escribió. El barrido solo manda el correo y estampa `reminderSentAt`.
Solo "pago vencido" y "salida próxima" crean filas, porque esos hechos no tienen
una tarea todavía.

---

## Rebanada 5A — datos y API

### 5A.1 Esquema

`packages/travel-db/prisma/schema.prisma`, modelo `Activity` (:850-893). Cuatro
columnas nuevas y tres cambios de índice:

```prisma
  assignedToId   String?
  assignedTo     User?     @relation("ActivityAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  reminderSentAt DateTime?
  sourceKey      String?

  @@unique([agencyId, sourceKey])
  @@index([agencyId, assignedToId, completedAt, dueAt])
  @@index([agencyId, dueAt])
```

- `@@index([dueAt])` suelto se retira. `@@index([agencyId, dueAt])` lo cubre y el
  barrido consulta por agencia.
- Relación inversa en `User`: `assignedActivities Activity[] @relation("ActivityAssignee")`.
- `onDelete: SetNull` — borrar un usuario deja la tarea sin dueño, no la borra.

Reglas de las columnas:

- `assignedToId` es `null` solo para tipos que no son `TASK`. `create` lo fija a
  `assignedToId ?? createdById` cuando el tipo es `TASK`.
- `reminderSentAt` lo escribe solo el barrido. `null` significa "nunca se avisó".
- `sourceKey` es `null` para toda tarea que escribe un humano. El barrido lo
  llena con `payment-overdue:<paymentId>` o `departure:<bookingId>`.

Cambios que acompañan al esquema:

| Archivo | Cambio |
| --- | --- |
| `packages/travel-db/prisma/migrations/` | Migración nueva por `bun run travel:migrate` |
| La migración, a mano | `UPDATE "activity" SET "assignedToId" = "createdById" WHERE "type" = 'TASK';` después del `ALTER TABLE` |
| `packages/travel-db/prisma/seed.ts` | Dos tareas por agencia: una con `dueAt` en el pasado, una en el futuro. Ambas asignadas al `owner` |
| `packages/travel-db/src/tenancy.ts` | **Sin cambio.** `Activity` ya está en `TENANT_MODELS` |
| `packages/travel-db/test/tenancy.spec.ts` | **Sin cambio.** `Activity` ya tiene su caso |
| `packages/travel-auth/travel-auth-generate` | El script borra las relaciones inversas de `User`. Revisar el diff a mano tras `travel:migrate` |

`bun run travel:auth:generate` **no se corre.** Solo `travel:migrate`.

### 5A.2 Contratos y servicio — `apps/travel-api/src/activities/`

**Colisión de "upcoming" que se resuelve.** Hoy `filterClause` usa `upcoming`
para "tarea abierta" y `myTasks` lo usa para `dueAt >= now`. El plan las separa:

- El **timeline** conserva su filtro `upcoming` = tarea sin cerrar. No cambia.
- La **bandeja** usa `window: "overdue" | "today" | "week" | "all"`, derivado de
  `dueAt` y `now()`. `myTasksInput.window` pasa de tres valores a estos cuatro.

Nadie renombra el filtro del timeline. Son dos vistas con dos vocabularios.

Cambios en `activities.contracts.ts`:

| Esquema | Cambio |
| --- | --- |
| `activityCreateInput` | `+ assignedToId: z.string().nullable().default(null)`. La refinación de `TASK` ya exige `subject` |
| `activityEntryOutput` | `+ assignedTo: activityAuthorOutput.nullable()`, `+ reminderSentAt: z.string().nullable()`, `+ sourceKey: z.string().nullable()` |
| `myTasksInput` | pasa a `taskListInput = listInput.extend({ window: z.enum(["overdue","today","week","all"]).default("all"), assignedToId: z.string().nullable().default(null), bookingId: z.string().nullable().default(null) })`. Sin `fields` ni `archived` |
| `taskListOutput` | `{ rows, total, facetCounts }` (de `ListResult`). Facetas `window` y `assignedTo` por `countsByKey` |
| `assignInput` | `z.object({ id: z.string(), assignedToId: z.string().nullable() })` |
| `updateTaskInput` | `z.object({ id: z.string(), subject: z.string().trim().max(200).optional(), body: z.string().trim().max(10000).nullable().optional(), dueAt: z.string().datetime().nullable().optional() })` |
| `removeInput` | `z.object({ id: z.string() })` |

**Ningún esquema de entrada acepta `agencyId`.** El `assignedToId` de
`activityCreateInput` es el asesor que recibe, no el llamador.

Cambios en `activities.service.ts`:

- `create` fija `assignedToId: isTask ? (input.assignedToId ?? actingUserId) : null`.
  Si `input.assignedToId` no es `null`, se relee por el cliente con alcance para
  confirmar que es miembro de la agencia. Sin miembro, lanza `BadRequestException`.
- `myTasks` se renombra a `tasks(agencyId, role, viewerId, input)`. Filtra por
  `assignedToId`. Para un rol sin `canSeeMargins`, fuerza
  `where.assignedToId = viewerId` y descarta el input. `window` traduce a un
  rango de `dueAt`. Devuelve `ListResult` con `paginate` y `countsByKey`.
- `complete` gana una guarda: solo el asignado o un rol con `canSeeMargins`
  cierra una tarea. Hoy cualquier miembro cierra cualquiera.
- `assign(agencyId, role, input)` y `updateTask(agencyId, role, input)` — nuevos.
  `requireManagerOrAssignee`. Relee la tarea por `findFirst`.
- `remove(agencyId, role, id)` — nuevo. Solo `TASK`. `requireManagerOrAssignee`.

Reglas heredadas que el servicio cumple:

- `agencyId` de `ctx`. Nunca input.
- `findUnique` lanza. Toda lectura por id usa `findFirst`.
- `Decimal` no aplica. Fechas salen como `toISOString()`.
- `new Logger(ActivitiesService.name)`, un objeto por llamada. Nunca `console.log`.

Cambios en `activities.router.ts`:

- `myTasks` pasa a `tasks`, con `restMeta("POST", "/activities/tasks/search", ["Activities"])`.
  Pasa `ctx.role` y `ctx.user.id`.
- `+ assign` — `POST /activities/{id}/assign`.
- `+ updateTask` — `PATCH /activities/{id}`.
- `+ remove` — `DELETE /activities/{id}`.
- `+ completeMany` — `POST /activities/complete-many`, cierra en lote. `runBulk`.

### 5A.3 El barrido de recordatorios

Archivos nuevos en `apps/travel-api/src/activities/`:

| Archivo | Contenido |
| --- | --- |
| `reminders-config.ts` | `REMINDERS as const`, con la forma de `currency-config.ts` |
| `reminders.service.ts` | `sweepAllAgencies()`. Prisma solo aquí |
| `reminders.controller.ts` | `@Controller("internal/sync")`, `GET`/`POST` `reminders`. Copia `rates.controller.ts` |
| `reminder-mailer.ts` | Función libre. Resend opcional. Copia `invitations.ts` |

`reminders-config.ts`, unidades derivadas de una base:

```ts
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const REMINDERS = {
  sweep: { maxAgenciesPerRun: 200, maxRowsPerAgency: 200 },
  departure: { windowDays: 7 },
  task: { resendAfterMs: 7 * DAY_MS },
} as const;
```

`reminders.service.ts` — `sweepAllAgencies()` lee la lista de agencias por el
cliente crudo, luego por cada una toma `agencyDb(this.db, agencyId)` y corre tres
pasos:

1. **Tarea vencida.** `type: TASK`, `completedAt: null`, `dueAt: { lt: now }`,
   `assignedToId: { not: null }`, y `reminderSentAt` nulo o menor que
   `now - resendAfterMs`. Por cada fila, `reminder-mailer` manda el correo al
   asignado. Luego `updateMany` estampa `reminderSentAt: now`. **No crea filas.**
2. **Pago vencido.** `scoped.payment.findMany` con el `where` de
   `dashboard.service.ts:46-49` (`status: "SCHEDULED"`, `dueDate: { lt: now }`).
   `createMany({ skipDuplicates: true })` de filas `TASK`:
   `sourceKey = "payment-overdue:<paymentId>"`, `bookingId = payment.bookingId`,
   `assignedToId = booking.ownerId`, `dueAt = payment.dueDate`,
   `subject = "Overdue payment on <folio>"`, `createdById = booking.ownerId`.
3. **Salida próxima.** `scoped.booking.findMany` con el `where` de
   `dashboard.service.ts:66-70` (`travelStartDate` entre `now` y
   `now + windowDays`). `createMany({ skipDuplicates: true })`:
   `sourceKey = "departure:<bookingId>"`, `assignedToId = booking.ownerId`,
   `dueAt = booking.travelStartDate`, `subject = "Trip departs soon — <folio>"`.

La restricción `@@unique([agencyId, sourceKey])` vuelve los pasos 2 y 3
idempotentes. El servicio devuelve
`{ agencies, reminded, created, skipped, mailed, mailFailed }`.

`reminders.controller.ts` copia `rates.controller.ts` **completo**:
`@ApiTags("Internal — Cron")`, `@ApiHeader` con `Bearer <TRAVEL_CRON_SECRET>`,
`@Get("reminders")` documentado, `@Post("reminders")` con `@ApiExcludeEndpoint()`,
ambos `@AllowAnonymous()`, el mismo `timingSafeEquals`, el mismo 503 sin
secreto. Delgado: llama `this.reminders.sweepAllAgencies()`.

`reminder-mailer.ts` copia `invitations.ts`:

```ts
export interface ReminderDelivery {
  delivered: boolean;
}

export async function sendReminderEmail(input: ReminderEmailInput): Promise<ReminderDelivery> {
  const apiKey = process.env.TRAVEL_RESEND_API_KEY;
  const from = process.env.TRAVEL_REMINDER_FROM;
  if (!apiKey || !from) return { delivered: false };
  try {
    const response = await fetch("https://api.resend.com/emails", { ... });
    return { delivered: response.ok };
  } catch {
    return { delivered: false };
  }
}
```

### 5A.4 Cableado

| Archivo | Cambio |
| --- | --- |
| `apps/travel-api/src/activities/activities.module.ts` | `+ controllers: [RemindersController]`, `+ RemindersService` en `providers` |
| `apps/travel-api/src/dashboard/dashboard.service.ts` | `+ tasks: { open, overdue }` en el resumen. `scope: "me"` filtra por `assignedToId` |
| `apps/travel-api/src/dashboard/dashboard.contracts.ts` | `+ tasks: z.object({ open: z.number(), overdue: z.number() })` en la salida |
| `apps/travel-api/src/generated/server.ts` | Regenerar con `bun run --filter=travel-api trpc:generate`. 14 routers, ~123 procedimientos. Se commitea |
| `apps/travel-api/vercel.json` | `+ { "path": "/internal/sync/reminders", "schedule": "0 8 * * *" }`. **Y quitar los 4 crons que no existen** (`mailboxes`, `telemetry/rollup`, `tracking/retention`, `archive/prune`) |
| `.env.example` | `TRAVEL_REMINDER_FROM` en la sección `# Travel`, con nota |
| `apps/travel-api/src/config/env.validation.ts` | `@IsOptional() @IsString() TRAVEL_REMINDER_FROM?: string` |
| `turbo.json` y `apps/travel-api/turbo.json` | `TRAVEL_REMINDER_FROM` en `globalPassThroughEnv` / `env` |
| `apps/travel-api/test/agency-id-inputs.spec.ts` | Ya cubre `activities`. Confirmar que `taskListInput`, `assignInput`, `updateTaskInput` entran en el barrido |

### 5A.5 Pruebas

`apps/travel-api/test/reminders.spec.ts` — nuevo. Estilo de `commissions.spec.ts`:
`new RemindersService(db, ...)`, `seedAgency("rem")`.

1. Dos agencias. El barrido de A no toca las filas de B.
2. Correr el barrido dos veces crea las filas de pago y salida una sola vez.
3. Sin `TRAVEL_CRON_SECRET`, el endpoint responde 503 y no escribe nada.
4. Con `authorization` incorrecto responde 403.
5. Sin `TRAVEL_RESEND_API_KEY`, el barrido termina. `mailed` es 0. No lanza.
6. Una tarea vencida con `reminderSentAt` de hace 3 días no se re-avisa
   (`resendAfterMs` es 7 días). Una de hace 8 días sí.

Ampliar `apps/travel-api/test/activities.spec.ts`:

7. Un `agent` recibe en `tasks` solo las tareas asignadas a él, incluidas las
   que escribió otro. No recibe las que él escribió y asignó a un tercero.
8. `create` con `assignedToId` de un no miembro lanza `BadRequestException`.
9. `assign` mueve la tarea. El `agent` de origen deja de verla.
10. Una tarea con `dueAt` en el pasado sale con `window: "overdue"`. Una con
    `dueAt` hoy sale con `window: "today"` y con `"week"`.
11. `complete` por un `agent` que no es el asignado lanza `ForbiddenException`.

---

## Rebanada 5B — la app

`apps/travel-app`. Rutas y textos en inglés, como 3A a 4B.

### 5B.1 El timeline

Se copia `apps/app/components/crm/timeline/` a
`apps/travel-app/components/travel/timeline/`. **Sin** `email-thread-entry.tsx`
ni `meeting-entry.tsx`: el modelo de viajes no tiene `emailThread` ni
`calendarEvent` (`status.md:291`). Quedan cinco archivos:

| Archivo | Cambio al portar |
| --- | --- |
| `timeline.tsx` | `TimelineAnchor` pasa a `{ customerId } \| { quoteId } \| { bookingId }`. Pestañas `all \| notes \| upcoming \| done`. Importa de `@crm/ui`, la tRPC de viajes y React |
| `timeline-entry.tsx` | Quita las ramas `EMAIL`/`MEETING` de render. Deja `NOTE`, `CALL`, `TASK`, `SYSTEM` |
| `activity-composer.tsx` | `+ un selector de asesor` cuando el tipo es `TASK`. Lee `trpc.users.list` |
| `activity-icon.tsx` | Sin cambio |
| `timeline-search-params.ts` | `TIMELINE_TABS` pasa a `["all","notes","upcoming","done"]` |

`apps/travel-app/lib/search-param-keys.ts` gana `record.timeline: "timeline"` en
el grupo `record`. Sin esa llave, `RESERVED_SEARCH_PARAM_KEYS` no la protege y
dos parsers de nuqs se corrompen entre sí.

### 5B.2 La pestaña en la ficha

`booking-sheet.tsx` y `quote-sheet.tsx` ya usan `DetailSheetTabs`. Se agrega un
renglón a la lista declarativa:

```tsx
{ value: "timeline", label: "Timeline", content: timelineTab, keepMounted: true }
```

`customer-sheet.tsx` **no tiene pestañas**: es un `DetailSheetBody` plano. Hay
que introducir `DetailSheetTabs` ahí primero, con `overview` (el contenido
actual) y `timeline`. `traveler-sheet.tsx` y `supplier-sheet.tsx` no reciben
timeline: el modelo `Activity` no las ancla.

### 5B.3 La bandeja de tareas

`app/(app)/[agency]/tasks/`, con la plantilla de cinco archivos de
`app/(app)/[agency]/commissions/`:

| Archivo | Nota |
| --- | --- |
| `page.tsx` | Servidor. `requireSession()` + `prefetchQuery` + `HydrateClient`, dentro de `<Suspense>` |
| `tasks-search-params.ts` | `createListSearchParams({ facetIds: ["window", "assignedTo"] })`. Sin `fields` ni `archived` |
| `tasks-table.tsx` | Cliente. `COLUMNS` a nivel de módulo + `useTableQuery` |
| `tasks-bulk-actions.tsx` | Completar en lote. `activities.completeMany` |
| `create-task-sheet.tsx` | `<Sheet>` por `?new=true`. Selector de ancla y de asesor |

La tabla no abre ficha propia. El clic abre la ficha del ancla
(`openRecord({ kind, id })` con `tab=timeline`), como la tabla de comisiones
abre la reserva. Una tarea de `sourceKey = "departure:*"` abre la reserva.

### 5B.4 Cableado del app

| Archivo | Cambio |
| --- | --- |
| `components/app-icon-rail.tsx:39-59` | `+ { title: "Tasks", href: "/tasks", icon: Task, match: "prefix" }` entre Commissions y Settings. `Task` de `@carbon/icons-react/es/Task` |
| `proxy.ts:13-22` | `+ "/tasks"` en `SECTIONS` |
| `lib/trpc/cache.ts` | `+ la llave de `activities.tasks`` en `activityKeys()`. `cache.activity()` ya existe |
| `app/(app)/[agency]/dashboard-summary.tsx` | Tarjeta "My tasks" con `open` y `overdue` de `dashboard.summary().tasks`. En un `DashboardRow` o como quinta métrica si el `StatGroup` lo permite |
| `app/(app)/[agency]/page.tsx` | Prefetch de `activities.tasks` con `window: "overdue"` |
| `components/travel/status-labels.ts` | Etiquetas de `window` y variante de badge (`overdue` en `destructive`) |

`lib/trpc/cache.ts` no toca `RecordKind` ni `BY_ID`: una tarea no es una ficha.

---

## Documentos

Se escriben al cerrar cada rebanada, no antes.

| Archivo | Cambio |
| --- | --- |
| `docs/travel/api.md` | Sección "Tareas y recordatorios": el router `activities` ampliado, el cron `/internal/sync/reminders`, el alcance por rol |
| `docs/travel/status.md` | Fase 5A y 5B, con archivos, decisiones, verificado y pendientes |

`docs/travel/money.md` no cambia. Un recordatorio no mueve dinero.

---

## Verificación

**5A**

```sh
docker compose up -d
bun run travel:migrate
bun run travel:seed
bun run travel:test
bun run --filter=@travel/db test
bun run --filter=travel-api test
curl -s localhost:3011/health
curl -s -X POST localhost:3011/internal/sync/reminders \
  -H "authorization: Bearer $TRAVEL_CRON_SECRET"
curl -s -X POST localhost:3011/internal/sync/reminders \
  -H "authorization: Bearer $TRAVEL_CRON_SECRET"
```

`bun run --filter=travel-api test` debe pasar de 186 a más de 195 casos. Swagger
debe mostrar `/internal/sync/reminders` bajo "Internal — Cron". La segunda
llamada al barrido debe devolver `created: 0`.

**5B**

```sh
bun run dev
open localhost:3010
```

Recorrido con dos cuentas en dos agencias:

1. Como `owner`, abre una reserva y crea una tarea en la pestaña Timeline.
   Asígnala a otro asesor.
2. Entra como ese asesor. La tarea sale en `/tasks`. La del `owner` no.
3. Pon `dueAt` en el pasado. La tarea sale con la etiqueta "Overdue".
4. Corre `/internal/sync/reminders`. Si Resend está configurado, llega el
   correo. `reminderSentAt` queda estampado.
5. Crea un `Payment` `SCHEDULED` con `dueDate` en el pasado. Corre el barrido.
   Aparece una tarea "Overdue payment on <folio>" anclada a la reserva.
6. Corre el barrido otra vez. No se duplica la tarea.
7. Desde la segunda agencia, pega la URL de una tarea ajena. No muestra nada.

**Antes de cada push**

```sh
bun run check-types && bun run lint && bun run lint:slop && bun run test
```

Los cuatro corren en CI y en `.githooks/pre-push`.

---

## Fuera de alcance

Las otras dos piezas de la Fase 4 en `plan_01.md:579-591` no entran aquí. Cada
una necesita su propio plan.

- **Documento de cotización.** Enlace público `/q/<token>` y PDF para el cliente.
  No hay generador de PDF ni ruta anónima en `apps/travel-app`. El hash de token
  de `apps/api/src/conversations/conversation-sharing.service.ts` es reusable,
  pero su transporte sigue autenticado. `Quote` no tiene `publicToken`.
- **`apps/travel-agent`.** El agente eve propio. Es un app nuevo completo.
  `apps/agent` es la plantilla. Necesita primero un modelo tipo `AgentTask` en
  `packages/travel-db`, que el esquema de viajes no tiene. Ninguna inteligencia
  entra a la API.

---

## Issues

1. BROKEN — `apps/travel-api/vercel.json` declara 5 crons. Solo
   `/internal/sync/rates` existe. Los otros 4 responden 404 en cada corrida.
   Fix: 5A.4 agrega `reminders` y quita los 4 muertos. Es una copia sin revisar
   de `apps/api/vercel.json`.
2. BROKEN — `docs/travel/status.md:614` dice que `record-stack.ts` ya tiene
   `timelineTabParser`. El archivo no lo tiene. `SEARCH_PARAM` de viajes no
   tiene la llave `timeline`.
   Fix: 5B.1 agrega la llave. La actualización de `status.md` corrige el renglón.
3. BROKEN — `docs/travel/plan_05.md` es un duplicado de `docs/travel/plan_04.md`.
   Los dos se titulan "Fase 4 — Comisiones al asesor". `status.md` solo cita
   `plan_04.md`.
   Fix: no está hecho. Borrar `plan_05.md` o renombrar la serie. Los dos
   archivos están sin seguimiento en git.
4. RISK — El router `activities` no lee `ctx.role` hoy. Todo miembro crea y
   completa cualquier actividad de la agencia.
   Fix: 5A.2 agrega el filtro por asignado y la guarda en `complete`, `assign`,
   `updateTask` y `remove`.
5. RISK — El barrido no toma un lease. Dos instancias en paralelo mandan el
   correo dos veces. Las filas no se duplican por la restricción única.
   Fix: no está hecho. Necesita un lease, como `apps/agent/agent/lib/tasks.ts`.
6. RISK — El barrido recorre todas las agencias en una petición. Con muchas
   agencias, la petición del cron excede el tiempo límite de la función.
   Fix: `REMINDERS.sweep.maxAgenciesPerRun` acota la corrida. Un cursor entre
   corridas queda pendiente.
7. NOT DONE — No hay recordatorio de documento por vencer (`plan_01.md:585`).
   El modelo `Document` no tiene fecha de expiración.
8. UNKNOWN — Si "salida próxima" debe re-avisar cuando la fecha de salida
   cambia. El `sourceKey` es por reserva, así que un cambio de fecha no genera
   una tarea nueva.
