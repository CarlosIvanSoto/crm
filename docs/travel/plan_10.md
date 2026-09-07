# Fase 8 — `apps/travel-agent`: seguimiento de cotizaciones enviadas

## Contexto

`docs/travel/status.md` cierra las fases 0 a 7B. `apps/travel-api` tiene 17
routers y 136 procedimientos. `apps/travel-app` tiene el shell, las seis
entidades, el tablero, comisiones, la bandeja de tareas, el documento de
cotización público y documentos.

`docs/travel/plan_01.md:579-591` fijó cuatro piezas para después de la base
sólida: comisiones (`plan_04.md`, HECHO), tareas y recordatorios
(`plan_07.md`, HECHO), el documento de cotización (`plan_08.md`, HECHO) y
`apps/travel-agent`. Las tres primeras están hechas. Esta es la cuarta y
última: **"Ninguna inteligencia entra a la API. Ni cliente de proveedor, ni
parseo de correos de mayoristas, ni sugerencias. La API escribe una fila de
tarea y deja que el agente decida."**

Problema: un asesor manda el enlace de una cotización (Fase 6) y no tiene
ninguna vía sistemática de seguimiento. Hoy solo ve "vista: sí/no" en la
pestaña Share si entra a mirar. Una cotización vista y no decidida se enfría
en silencio.

Resultado de la Fase 8: `apps/travel-agent`, una app eve nueva y propia — su
propio despliegue, igual que `apps/agent` es del CRM. Un barrido diario en
`apps/travel-api` encuentra cotizaciones enviadas, vistas y no decididas desde
hace varios días, y escribe una fila `AgentTask`. El agente lee el contexto de
la cotización (de solo lectura) y redacta **una** tarea (`Activity` `TASK`)
para el asesor dueño, con un mensaje de seguimiento sugerido. El agente nunca
manda el correo, nunca cambia el estado de la cotización, nunca decide nada
por el asesor — exactamente la misma frontera que ya sostiene el resto del
producto.

`apps/agent` (CRM) es la plantilla obligatoria de lectura
(`docs/agent.md`, `apps/agent/node_modules/eve/docs`), pero es un sistema
maduro con motor de evidencia, vendor de enriquecimiento, modelo dinámico por
fila, presupuesto por sesión, dos carriles de despacho, constructor y
ejecutor de agentes de equipo. Viajes no tiene un vendor equivalente a
Context.so y no lo necesita para este primer trabajo: la fase copia solo la
plomería que un trabajo de investigación real necesita (fila de tarea,
despacho, canal, sandbox, una herramienta de escritura) y deja explícitamente
fuera todo lo que esa madurez fue construyendo con el tiempo. Ver "Fuera de
alcance" en 8A.

Reglas leídas: `AGENTS.md`, `docs/design.md`, `docs/travel/domain.md`,
`docs/travel/api.md`, `docs/travel/money.md`, `docs/agent.md`,
`docs/agent-panel.md`, `docs/environment.md`, `docs/setup.md`. Skill:
`.agents/skills/eve` — y su copia instalada,
`apps/agent/node_modules/eve/docs`, antes de escribir código eve, tal como
pide `docs/agent.md`.

## Decisiones fijadas

| Decisión | Elección |
| --- | --- |
| App | `apps/travel-agent`, eve propio, puerto **2010** (agente CRM es 2000; API de viajes es 3011, un +10 sobre el CRM, mismo patrón) |
| Disparo | Barrido diario en `travel-api` (`/internal/sync/quote-followups`), no un evento en `quoteShare.send` — la condición es tiempo transcurrido, no una acción puntual |
| Un solo tipo de tarea | `quote-followup`. Sin carriles (`DIRECT_KINDS` vs investigación) — todo el volumen de esta fase es una sesión eve por fila |
| Acceso a datos | El agente lee `@travel/db` directo, igual que `apps/agent` lee `@crm/db` directo — nunca vía tRPC. Toda lectura pasa por `agencyDb(this.db, agencyId)`, `agencyId` sale de la fila reclamada, nunca del input |
| La única escritura | Una `Activity` `TASK` (`docs/travel/api.md`'s "tasks"), asignada al dueño de la cotización. El agente nunca manda correo, nunca cambia `Quote.status`, nunca toca `QuoteShare` |
| Modelo | Constante fija en un módulo de configuración, no una fila `AppSetting` dinámica — viajes no tiene ese modelo y no lo necesita todavía para un solo tipo de tarea |
| Presupuesto | Sin `lib/focus.ts`. No hay llamada a vendor que cueste crédito que racionar en esta fase |
| Vendor de enriquecimiento | Ninguno. Las herramientas leen solo lo que ya está en `@travel/db` |
| Panel | 8B. Copia `apps/app/components/crm/agent-panel.tsx` y
`apps/app/app/eve/v1/[...path]/route.ts`, adaptados a un solo tipo de
registro (`quote`) |

La fase se corta en dos rebanadas, igual que 3, 4, 5 y 6:

- **8A** — datos, `apps/travel-agent`, el disparador en `apps/travel-api`.
- **8B** — la app: el puente y la pestaña Agent en la ficha de cotización.

---

# 8A — Datos, `apps/travel-agent` y el disparador

## 1. Esquema — `packages/travel-db/prisma/schema.prisma`

### 1.1 Modelo `AgentTask`

Va después del bloque `Activity`, antes de `enum FieldEntity`. Copia el
esquema de `@crm/db`'s `AgentTask` (`packages/db/prisma/schema.prisma:466`)
con un solo cambio de forma: un `quoteId` en vez de `contactId` /
`companyId` / `dealId`, porque esta fase tiene un solo tipo de ancla.

```prisma
model AgentTask {
  id       String       @id @default(cuid())
  agencyId String
  agency   Organization @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  quoteId String?
  quote   Quote?  @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  kind    String
  reason  String
  payload Json?

  priority Int @default(0)
  budget   Int @default(4)
  attempts Int @default(0)

  dueAt       DateTime
  leasedUntil DateTime?

  sessionId  String?
  startedAt  DateTime?
  finishedAt DateTime?
  outcome    String?

  subject String?

  createdAt DateTime @default(now())

  @@index([dueAt, leasedUntil])
  @@index([quoteId])
  @@index([agencyId, kind, subject], where: { finishedAt: null })
  @@map("agentTask")
}
```

`kind` queda `String`, no un enum — un solo valor hoy (`"quote-followup"`),
pero un enum obliga a una migración por cada tipo nuevo; `@crm/db` tomó la
misma decisión con veinte tipos.

### 1.2 Modelo `AgentConversation`

El identificador de una sesión eve abierta sobre una cotización — el
"handle", nunca la transcripción (`docs/agent-panel.md`). 8A lo crea porque
`apps/travel-agent` lo necesita para el registro de sesiones despachadas;
8B es quien lo lee.

```prisma
model AgentConversation {
  id String @id @default(cuid())

  agencyId String
  agency   Organization @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  quoteId String
  quote   Quote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  userId String?
  user   User?   @relation("AgentConversationOwner", fields: [userId], references: [id], onDelete: SetNull)

  sessionId         String? @unique
  continuationToken String?
  streamIndex       Int     @default(0)

  lastMessageAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([agencyId, quoteId, createdAt])
  @@map("agentConversation")
}
```

`userId` es opcional: una conversación nacida del barrido no tiene un humano
que la abrió; una que un asesor empieza en la pestaña Agent (8B) sí.

### 1.3 Relaciones inversas

| Modelo | Campo nuevo |
| --- | --- |
| `Organization` | `agentTasks AgentTask[]`, `agentConversations AgentConversation[]` |
| `Quote` | `agentTasks AgentTask[]`, `agentConversations AgentConversation[]` |
| `User` | `agentConversations AgentConversation[] @relation("AgentConversationOwner")` |

### 1.4 Tenencia — `packages/travel-db/src/tenancy.ts`

Agregar `"AgentTask"` y `"AgentConversation"` a `TENANT_MODELS`, después de
`"QuoteShare"`. **Sin esto una agencia lee las tareas o conversaciones de
otra** — el mismo riesgo que `plan_04.md`'s issue 1 ya cerró para
`Commission`.

### 1.5 Migración

Misma vía que 5A/6A/7A — `prisma migrate dev` no corre sin TTY:

```sh
docker compose up -d
bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma \
  --script > prisma/migrations/<ts>_agent_task/migration.sql
bun run --filter=@travel/db travel:deploy
```

`bun run travel:auth:generate` no se corre — el generador borra las
relaciones inversas de `Organization` y `User`. Actualizar el aviso de
`packages/travel-auth/README.md` con las dos relaciones nuevas.

## 2. `apps/travel-agent` — la app nueva

```
apps/travel-agent/
  package.json              name "travel-agent"
  tsconfig.json              extiende @crm/typescript-config
  turbo.json                 dev, dev:headless, dispatch, build, test — copiados de apps/agent/turbo.json
  agent/
    agent.ts                 defineAgent — modelo fijo, sin defineDynamic
    instructions.md
    instructions/
      task.ts                 preamble para kind "quote-followup" — el único
    channels/
      travel.ts                defineChannel: rutas de despacho + receive()
    schedules/
      dispatch.ts               defineSchedule cron "* * * * *"
    tools/
      read_quote.ts              folio, destino, fechas, pax, status, opciones y renglones
      read_quote_share.ts        viewCount, firstViewAt, lastViewAt, sentAt, revokedAt
      read_customer.ts           nombre, correo, teléfono
      write_followup_task.ts     la única escritura — crea la Activity TASK
    lib/
      db.ts                      cliente @travel/db + agencyDb, sin exponer DATABASE_URL al sandbox
      tasks.ts                    claimDue (FOR UPDATE SKIP LOCKED), completeTask — recorte de apps/agent/agent/lib/tasks.ts
      dispatch.ts                 drainAll, brief(), taskAuth() — recorte de apps/agent/agent/lib/dispatch.ts, sin carriles
      model-config.ts             TRAVEL_AGENT_MODEL — la constante fija
    sandbox/
      sandbox.ts                  bash + archivos, /workspace, deny-all egress — copia literal del patrón de apps/agent
```

### 2.1 `agent.ts`

```ts
import "@crm/env/load";
import { defineAgent } from "eve";
import { TRAVEL_AGENT_MODEL } from "./lib/model-config";

export default defineAgent({
  model: TRAVEL_AGENT_MODEL,
  limits: {
    maxInputTokensPerSession: 200_000,
    maxOutputTokensPerSession: 20_000,
    sessionTimeoutMs: 10 * 60 * 1000,
  },
});
```

Sin `defineDynamic`: un modelo fijo en `lib/model-config.ts`, la regla de
"constantes en un módulo por área" de `AGENTS.md`. `@crm/env/load` sigue
siendo correcto — es la raíz `.env` compartida, no un paquete de dominio.

### 2.2 `channels/travel.ts`

Copia el patrón de `apps/agent/agent/channels/crm.ts`, recortado a lo que
esta fase usa: sin builder, sin runs de agente de equipo, sin
`verify-key`, sin Slack.

```
routes:
  GET  /internal/travel/dispatch-health   — igual forma que dispatch-health del CRM
  POST /internal/travel/dispatch          — reclama y despacha AgentTask pendientes

events:
  session.completed / turn.failed / session.waiting / turn.cancelled
    → completeTask(continuationToken, outcome)   (lib/tasks.ts)

receive(input, { send }):
  → send(brief(task), { auth: input.auth, continuationToken: taskToken(task.id) })
```

`authorised(request)` lee `TRAVEL_AGENT_BRIDGE_SECRET` con
`timingSafeEqual`, copia literal de la función del mismo nombre en
`channels/crm.ts`. **Sin la variable, cada ruta responde 401** — la misma
regla de "no configurada, no abierta" del resto del producto.

### 2.3 `schedules/dispatch.ts`

```ts
import { defineSchedule } from "eve/schedules";
import travel from "../channels/travel";
import { brief, drainAll, taskAuth } from "../lib/dispatch";

export default defineSchedule({
  cron: "*/10 * * * *",
  async run({ receive, waitUntil, appAuth }) {
    waitUntil(
      drainAll((task) =>
        receive(travel, {
          message: brief(task),
          target: { taskId: task.id },
          auth: taskAuth(task, appAuth),
        }),
      ),
    );
  },
});
```

Cada diez minutos, no cada minuto — el volumen de esta fase es una cotización
sin decidir por agencia, no un flujo de contactos entrando constantemente.
`docs/agent.md`'s advertencia sobre `eve dev` sigue aplicando: el reloj no
corre bajo `eve dev`, así que `bun run --filter=travel-agent dispatch`
(alias del mismo `curl` que usa `apps/agent`) es la vía de prueba local.

### 2.4 Las herramientas

Las tres de lectura siguen la forma de `read_crm_history.ts`: sin ramas de
confianza, un objeto plano, y **siempre traen el id de la cotización** en la
respuesta — la regla de "tres registros, sin caminos muertos" de
`docs/agent.md`, reducida a un solo registro porque esta fase tiene uno.
Ninguna trae `cost*` ni `margin*` — el agente redacta un mensaje para el
cliente potencial, no decide sobre el margen.

`write_followup_task.ts` es la única escritura:

```ts
export default defineTool({
  description:
    "File the drafted follow-up as a task for the quote's advisor. Never sends anything — a human reads it and decides.",
  inputSchema: z.object({
    quoteId: z.string(),
    message: z.string().min(20).max(2000),
  }),
  async execute({ quoteId, message }, ctx) {
    const task = taskFromContext(ctx);
    const quote = await readOwnedQuote(task.agencyId, quoteId);
    if (!quote.ownerId) {
      return { filed: false, reason: "This quote has no owner to assign the task to." };
    }

    await agencyDb(db, task.agencyId).activity.create({
      data: {
        type: "TASK",
        subject: `Follow up on quote ${quote.folio}`,
        body: message,
        dueAt: new Date(),
        quoteId,
        createdById: quote.ownerId,
        assignedToId: quote.ownerId,
        sourceKey: `quote-followup:${quoteId}:${isoDate(task.dueAt)}`,
      },
    });

    return { filed: true };
  },
});
```

`createdById` y `assignedToId` son el `ownerId` de la cotización — el mismo
patrón que `reminders.service.ts` ya usa para sus filas `TASK` generadas
por sistema (`apps/travel-api/src/activities/reminders.service.ts:162`):
`Activity.createdById` es obligatorio y no hay un usuario "sistema", así que
la tarea se atribuye al asesor responsable. Aparece sola en su bandeja de
tareas (Fase 5) — cero interfaz nueva. `sourceKey` reusa
`@@unique([agencyId, sourceKey])`, ya en el modelo — un segundo intento de
escribir el mismo seguimiento en la misma fecha choca en la base, no en un
`SELECT` previo, el mismo patrón de `documents.spec.ts`'s vencimiento.

### 2.5 El sandbox

`agent/sandbox/sandbox.ts` — `bash`, herramientas de archivo, `/workspace`,
`deny-all` en la fábrica del backend. **Nunca `TRAVEL_DATABASE_URL` en el
sandbox** — el acceso a viajes son las cuatro herramientas autoradas, igual
que la regla ya escrita en `docs/agent.md`: "una consola con credenciales y
red es exfiltración; sin ninguna de las dos es un procesador de texto."

## 3. `apps/travel-api` — el disparador

### 3.1 Módulo `agent` — `apps/travel-api/src/agent/`

```
apps/travel-api/src/agent/
  agent-dispatch.config.ts    poke.timeoutMs, sweep.maxAgenciesPerRun — un objeto, la regla de constantes
  bridge.ts                    lee TRAVEL_AGENT_URL / TRAVEL_AGENT_BRIDGE_SECRET — copia de apps/api/src/agent/bridge.ts
  quote-followup-config.ts    QUOTE_FOLLOWUP = { firstCheckAfterDays: 3, reminderIntervalDays: 5 }
  quote-followup.service.ts   sweepAllAgencies() — recorre agencias, decide, escribe AgentTask, pokea
  quote-followup.controller.ts  GET|POST /internal/sync/quote-followups
  agent.module.ts
```

`bridge()` devuelve `null` sin `TRAVEL_AGENT_BRIDGE_SECRET` — "no hay puente,
no uno abierto", la misma frase que ya sostiene el bridge del CRM. Todo
llamador dice qué hace sin el agente: aquí, nada — el barrido sigue
escribiendo `AgentTask`, el reloj de `apps/travel-agent` las recoge en su
siguiente `*/10 * * * *` aunque el poke no aterrice.

### 3.2 `quote-followup.service.ts` — la regla

Por agencia, sobre `Quote` con `status IN (SENT)`, `archivedAt: null`,
`ownerId: { not: null }`, con un `QuoteShare` vivo o revocado (no importa —
ya fue vista o mandada):

1. Si ya hay un `AgentTask` sin terminar (`finishedAt: null`) para esa
   cotización, no hacer nada — el índice parcial de 1.1 es exactamente para
   esta consulta.
2. Si la última `Activity` con `sourceKey` que empieza
   `quote-followup:${quoteId}:` tiene menos de
   `QUOTE_FOLLOWUP.reminderIntervalDays` días, no hacer nada — no se
   re-avisa todos los días.
3. Si `quote.sentAt` (o `share.firstViewAt`, lo que sea más reciente) tiene
   menos de `QUOTE_FOLLOWUP.firstCheckAfterDays` días, no hacer nada — dale
   tiempo al cliente antes de sugerir un empujón.
4. Si no, escribir un `AgentTask`:

```ts
await agencyDb(this.db, agencyId).agentTask.create({
  data: {
    kind: "quote-followup",
    reason: `Quote ${quote.folio} was sent ${daysAgo} days ago and is still undecided.`,
    quoteId: quote.id,
    subject: quote.id,
    dueAt: new Date(),
    priority: PRIORITY.quoteFollowup,
  },
});
```

Al final de la corrida, si se escribió al menos una fila, `bridge.poke()` —
`POST /internal/travel/dispatch`, sin esperar la respuesta, igual que
`AgentTriggerService.poke()`. El endpoint falla cerrado igual que
`rates.controller.ts` y `reminders.controller.ts`: sin
`TRAVEL_CRON_SECRET` responde 503; con uno que no calza, 403.

`vercel.json`: `+ { "path": "/internal/sync/quote-followups", "schedule": "0 9 * * *" }`
— una hora después del barrido de recordatorios (8am), para no competir por
el mismo minuto.

## 4. Variables nuevas

| Archivo | Cambio |
| --- | --- |
| `.env.example` | `# TRAVEL_AGENT_URL="http://127.0.0.1:2010"` y `# TRAVEL_AGENT_BRIDGE_SECRET=""`, con la nota de que sin la segunda no hay puente, sección Travel |
| `.env.example` | `# TRAVEL_AI_GATEWAY_API_KEY=""`, nota "en Vercel esto lo resuelve OIDC por proyecto; fuera de Vercel hace falta una llave" — copia de la nota de `AI_GATEWAY_API_KEY` |
| `turbo.json` (raíz) | `+ TRAVEL_AGENT_URL`, `+ TRAVEL_AGENT_BRIDGE_SECRET`, `+ TRAVEL_AI_GATEWAY_API_KEY` en `globalPassThroughEnv` |
| `apps/travel-api/turbo.json` | `+ TRAVEL_AGENT_URL`, `+ TRAVEL_AGENT_BRIDGE_SECRET` en `passThroughEnv` de `dev`/`start` |
| `apps/travel-agent/turbo.json` | `+ TRAVEL_AGENT_BRIDGE_SECRET`, `+ TRAVEL_AI_GATEWAY_API_KEY`, `+ TRAVEL_DATABASE_URL` en `passThroughEnv` de `dev`/`dev:headless` |
| `apps/travel-api/src/config/env.validation.ts` | `@IsOptional() @IsString() TRAVEL_AGENT_URL?: string`, `@IsOptional() @IsString() TRAVEL_AGENT_BRIDGE_SECRET?: string` |

`TRAVEL_CRON_SECRET` ya existe (Fase 5A) — el barrido de seguimientos lo
reusa, el mismo secreto que ya guarda `/internal/sync/rates` y
`/internal/sync/reminders`.

## 5. Cableado

| Archivo | Cambio |
| --- | --- |
| `apps/travel-api/src/app.module.ts` | `+ AgentModule`, después de `ActivitiesModule` |
| `package.json` (raíz) | Sin alias nuevo — `bun run dev` ya arranca todo por Turbo; documentar el puerto 2010 en `docs/setup.md` |
| `docker-compose.yml` | Sin cambio — `apps/travel-agent` no tiene base de datos propia, usa `TRAVEL_DATABASE_URL` |
| `biome.jsonc`, `knip.json`, `.oxlintrc.json` | Bloques `apps/travel-agent/**`, copiando la forma que ya tienen `apps/agent/**` |
| `.github/workflows/ci.yml` | `+ apps/travel-agent` en `check-types`/`lint`/`test` del fan-out |

## 6. Pruebas

### 6.1 `packages/travel-db/test/tenancy.spec.ts`

Dos casos más: `agentTask` y `agentConversation` de la agencia A no los lee
`agencyDb(db, agencyB)`, y `create` con `agencyId: agencyB` fija `agencyA`.
Pasa de 14 a 16 casos.

### 6.2 `apps/travel-api/test/quote-followups.spec.ts` (nuevo)

Estilo `reminders.spec.ts`, dos agencias:

1. Sin `TRAVEL_CRON_SECRET` → 503. Con uno que no calza → 403.
2. Una cotización `SENT` hace 5 días, sin `AgentTask` abierto → escribe una
   fila.
3. Una cotización `SENT` hace 1 día → no escribe nada todavía
   (`firstCheckAfterDays`).
4. Una cotización con un `AgentTask` sin terminar → no duplica la fila.
5. Una cotización con una `Activity` de seguimiento de hace 2 días → no
   vuelve a escribir (`reminderIntervalDays`).
6. Una cotización `ACCEPTED`, `DECLINED` o `archivedAt` no nulo → nunca se
   considera.
7. Una cotización sin `ownerId` → se salta, no lanza.
8. Aislamiento: el barrido de la agencia A nunca escribe una fila con
   `agencyId` de B.

### 6.3 `apps/travel-agent/test/`

- `dispatch.spec.ts` — `claimDue` reclama con `FOR UPDATE SKIP LOCKED`, no
  dos veces la misma fila en paralelo; una fila reclamada y nunca resuelta
  se libera pasado el lease.
- `channel-auth.spec.ts` — sin `TRAVEL_AGENT_BRIDGE_SECRET`, cada ruta
  responde 401.
- `write-followup-task.spec.ts` — la herramienta crea una `Activity` `TASK`
  con `sourceKey` idempotente; una segunda llamada con la misma fecha no
  duplica (choca en la base, la herramienta lo reporta, no lanza sin
  atrapar).

Corre contra Postgres 5433, igual que el resto del paquete `@travel/db` y
`travel-api`.

## Fuera de alcance de 8A

Todo lo que `apps/agent` construyó con el tiempo y esta fase no necesita
todavía para un solo tipo de tarea:

- **Modelo dinámico por fila (`AppSetting` + `defineDynamic`).** Viajes no
  tiene ese modelo; un modelo fijo en `lib/model-config.ts` alcanza para un
  tipo de tarea.
- **Presupuesto por sesión (`lib/focus.ts`).** No hay llamada a vendor que
  cueste crédito en esta fase — nada que racionar.
- **Motor de evidencia y escritura de campos (`lib/facts.ts`).** El agente
  no cambia ningún campo del dominio; escribe una tarea, un humano decide.
- **Carriles de despacho (visible/investigación).** Un solo tipo, una sola
  forma de trabajar la fila.
- **Constructor y ejecutor de agentes de equipo.** No hay agentes
  personalizados en viajes.
- **`AgentEvent` (el archivo de auditoría durable).** 8B explica el efecto:
  sin transcripción más allá de los 30 días de retención de eve.
- **Otros tipos de tarea** — investigación de destino, verificación de
  proveedor, seguimiento de comisión desincronizada. Cada uno necesita su
  propio plan, como esta fase lo necesitó.

---

# 8B — Pestaña Agent en la ficha de cotización

## 1. El puente — `apps/travel-app/app/agent/v1/[...path]/route.ts`

Copia el patrón de `apps/app/app/eve/v1/[...path]/route.ts`: revisa la
sesión de Better Auth, revisa que el `agencyId` de la sesión sea dueño de la
`quoteId` pedida (`agencyDb`, no confía en el cliente), acuña un token
HS256 de 2 minutos con el asesor y el id de la cotización, y lo reenvía a
`TRAVEL_AGENT_URL`. **El registro viaja en el token, nunca en el mensaje** —
la misma regla que `docs/agent.md` ya fija para el CRM.

Montado en `/agent/v1/*` porque es donde mira `useTravelAgent()` — sin
`host`, sin CORS, sin cookie entre sitios, el mismo motivo que el CRM monta
en `/eve/v1/*`.

## 2. Router `agentConversation` — `apps/travel-api/src/agent/`

Un archivo más en el módulo de 8A. `@UseMiddlewares(AuthMiddleware,
AgencyMiddleware)` — de solo lectura, la escritura del handle la hace el
propio agente vía `@travel/db` directo.

- `list(quoteId)` — las conversaciones de esa cotización, más recientes
  primero. `agencyDb` filtra la agencia, `where: { quoteId }` filtra el
  registro.
- `latest(quoteId)` — la más reciente, o `null`. El panel la usa para
  decidir si abre un hilo existente o arranca uno nuevo.

Sin `create` ni `update` — esas filas las escribe `apps/travel-agent`
mismo, con el cliente `@travel/db` que ya tiene.

## 3. `useTravelAgent()` y el panel

`apps/travel-app/lib/agent/use-travel-agent.ts` — copia de
`apps/app`'s `useEveAgent()` (nombre exacto a confirmar al leer el archivo
real, `docs/agent-panel.md` es la referencia de comportamiento), apuntado a
`/agent/v1`. `apps/travel-app/components/travel/quotes/agent-panel.tsx` —
copia de `apps/app/components/crm/agent-panel.tsx`, recortada a un solo tipo
de registro (`quote`): sin selector de tipo, sin las ramas de contacto,
compañía o trato.

- `session.snapshot()` es la única vía de cargar un hilo — nunca un `fetch`
  a mano del stream. `docs/agent-panel.md` documenta por qué cada atajo
  aquí ya falló una vez en el CRM.
- `?thread=` en la URL, como cualquier otro estado de la ficha.
  `record-stack.ts` gana la llave, junto a `record.timeline` que ya existe.
- `keepMounted` en el descriptor de la pestaña (`detail-sheet.tsx` /
  `record-sheet-host.tsx`) — cambiar de pestaña no debe cortar una
  respuesta en curso.

## 4. Pestaña Agent en `quote-sheet.tsx`

`apps/travel-app/components/travel/record-sheet/quote-sheet.tsx` gana una
quinta pestaña, después de `share`:

```
{ value: "agent", label: "Agent", content: agentTab }
```

Cualquier miembro que ve la cotización abre la pestaña — sin predicado
nuevo, el mismo criterio que ya usa la pestaña Share. Una tarea que el
barrido de 8A generó aparece igual en la bandeja de tareas (Fase 5) sin
que el asesor abra nunca la pestaña Agent; la pestaña es para conversar,
no la única vía de enterarse.

## 5. Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `apps/travel-app/components/travel/record-sheet/record-stack.ts` | `+ record.agentThread` en `params`, se limpia en `write()` |
| `apps/travel-app/lib/search-param-keys.ts` | `+ record.agentThread: "thread"` |
| `apps/travel-app/proxy.ts` | `+ "/agent"` en `SECTIONS` (autenticado, no público — a diferencia de `/q`) |
| `apps/travel-app/lib/trpc/cache.ts` | `+ agentConversation(quoteId)` |

## Fuera de alcance de 8B

- **`AgentEvent` y el respaldo sin conexión.** Sin archivo de auditoría
  durable (8A), un agente inalcanzable no tiene transcripción de respaldo
  que mostrar — el panel dice "agente no disponible" en vez de degradar a
  un archivo, y un hilo pasado los 30 días de retención de eve deja de
  leerse. Ver Issues.
- **Notificación al asesor de que hay una tarea nueva.** La tarea aparece
  en su bandeja (Fase 5), sin aviso adicional.
- **Editar o eliminar el mensaje sugerido desde la pestaña.** El asesor
  edita la `Activity` `TASK` como cualquier otra, desde el timeline.

---

## Documentación al cerrar

| Archivo | Cambio |
| --- | --- |
| `docs/travel/plan_10.md` | Este plan, en el repositorio, como los anteriores |
| `docs/agent.md` | Nota al final: `apps/travel-agent` existe, es un recorte deliberado, no una copia — enlaza aquí en vez de duplicar las reglas |
| `docs/travel/api.md` | Sección del router `agentConversation`; el barrido `/internal/sync/quote-followups` junto a rates y reminders |
| `docs/travel/domain.md` | `AgentTask`/`AgentConversation` en la lista de modelos con `agencyId`; el agente como tercer lector directo de `@travel/db` (junto a `travel-api` y los scripts) |
| `docs/travel/status.md` | Fases 8A y 8B, con archivos, decisiones, verificado y pendientes |
| `docs/setup.md` | `TRAVEL_AGENT_URL`/`TRAVEL_AGENT_BRIDGE_SECRET`, puerto 2010, la fila de `bun run dev` |
| `docs/environment.md` | Las variables nuevas, con el patrón `TRAVEL_*` ya establecido |
| `.env.example` | `TRAVEL_AGENT_URL`, `TRAVEL_AGENT_BRIDGE_SECRET`, `TRAVEL_AI_GATEWAY_API_KEY` |

## Verificación

```sh
docker compose up -d
bun run --filter=@travel/db travel:deploy
bun install
bun run dev                          # crm 3000/3001/2000, travel 3010/3011/2010
bun run --filter=travel-agent dispatch
bun run --filter=@travel/db test     # 14 → 16 casos
bun run --filter=travel-api test     # + quote-followups.spec.ts
bun run --filter=travel-agent test
bun run check-types
bun run lint && bun run lint:slop
bun run --filter=travel-app build    # sin "Module not found: dns"
```

Recorrido manual, dos cuentas en dos agencias:

1. Mandar una cotización (Fase 6). Retroceder `Quote.sentAt` a mano, cinco
   días atrás, en la base local.
2. `bun run --filter=travel-agent dispatch` a mano (el cron no corre bajo
   `eve dev`). Ver la sesión en el panel `eve dev`.
3. La bandeja de tareas del asesor dueño (Fase 5) tiene una tarea nueva,
   con el folio en el asunto y un mensaje redactado en el cuerpo.
4. Correr el barrido otra vez. Ninguna tarea duplicada.
5. Abrir la pestaña Agent de la cotización. El hilo que el barrido generó
   se puede continuar con una pregunta ad hoc.
6. Desde la segunda agencia, la misma cotización no aparece en ningún lado
   — ni en su bandeja de tareas, ni por `agentConversation.list`.
7. Aceptar la cotización. El siguiente barrido ya no la considera.

## Issues

1. NOT DONE — Sin `AgentEvent`. La pestaña Agent no tiene respaldo cuando el
   agente está inalcanzable, y un hilo pasado los 30 días de retención de
   eve deja de leerse.
   Fix: no hecho. Necesita el modelo y el hook de auditoría de
   `apps/agent`, una fase aparte.
2. RISK — El barrido cubre solo `Quote.status = SENT`. Una cotización
   `ACCEPTED` con una opción sin decidir de facto (el cliente vio dos veces
   y no eligió ninguna) no genera seguimiento.
   Fix: no hecho. `publicQuote.view` no distingue "vio y decidió no elegir"
   de "no ha vuelto a entrar".
3. RISK — Sin límite de agencias por corrida más allá de
   `maxAgenciesPerRun`; con muchas agencias activas la corrida diaria puede
   tardar. El mismo riesgo que ya tiene `reminders.controller.ts`.
   Fix: no hecho. Mismo patrón, mismo pendiente.
4. NOT DONE — Un solo tipo de tarea. Investigación de destino, verificación
   de proveedor y comisión desincronizada quedan fuera, cada una necesita
   su propio plan.
5. NOT DONE — Sin modelo dinámico por agencia ni presupuesto por sesión.
   Aceptado mientras haya un solo tipo de tarea sin llamadas a vendor.
6. UNKNOWN — Si el mensaje que redacta el agente debe ir en inglés o en el
   idioma de la cotización. El plan no lo fija; `notes`/`terms` de `Quote`
   son texto libre y no cargan el idioma del cliente.
