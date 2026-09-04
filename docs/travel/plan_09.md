# Fase 7 — Documentos

## Contexto

`docs/travel/status.md` cerraba las fases 0 a 6B. El modelo `Document` existía
desde la Fase 1 (`schema.prisma`) y nunca tuvo módulo — subir un voucher, un
boleto o un pasaporte no existía. Es el último pendiente de datos que quedaba
de la lista original de `plan_01.md`; `apps/travel-agent` sigue fuera de
alcance y necesita su propio plan.

Resultado: un asesor sube el voucher del mayorista a la reserva y el pasaporte
al pasajero. Los ve, los descarga y los borra. Los bytes nunca pasan por la
API — solo un token de subida acotado. El barrido de recordatorios avisa
cuando un pasaporte vence antes del viaje.

Reglas leídas: `AGENTS.md`, `docs/design.md`, `docs/travel/domain.md`,
`docs/travel/api.md`, `docs/travel/status.md`, `docs/travel/plan_01.md`,
`docs/travel/plan_08.md`.

## Decisiones fijadas

| Decisión | Elección |
| --- | --- |
| Privacidad | `access: "private"` en `@vercel/blob`. Un pasaporte nunca vive en una URL pública |
| Ruta de subida | La API acuña un token acotado a un `pathname` (`generateClientTokenFromReadWriteToken`); el navegador sube directo con `put()` de `@vercel/blob/client`. Los bytes nunca pasan por la función serverless |
| Ruta de lectura | `issueSignedToken` + `presignUrl({ operation: "get" })` por petición, URL de 5 minutos. `Document.url` sola no abre nada |
| Columna nueva | `Document.pathname`, con `@@unique([agencyId, pathname])` y el prefijo `agencies/<agencyId>/…` como segunda barrera |
| Sin token de blob | Capacidad removida, no excepción global. `uploadToken` responde 503; `list`/`byId`/`remove` siguen |
| Borrar | Borrado duro. `del(pathname)` primero, la fila después. Un error de borrado en el almacén se registra y no bloquea el borrado de la fila |
| Alcance por rol | Cualquier miembro sube. Un `agent` lee solo lo anclado a sus reservas y a los pasajeros de esas reservas. Quitar exige el que subió o `canSeeMargins`. Sin predicado nuevo |
| Vencimiento | El barrido usa `Traveler.documentExpiresAt`, que ya existía con índice. `Document` no gana fecha de vencimiento |
| Corte | 7A datos y API. 7B la app |

---

# 7A — Datos y API

## 1. Esquema

`packages/travel-db/prisma/schema.prisma` — `Document` gana `pathname` y
`updatedAt`, más `@@unique([agencyId, pathname])`, `@@index([agencyId, kind])`
y `@@index([agencyId, createdAt])`.

Migración `20260904164349_document_pathname`: `ADD COLUMN` con `DEFAULT`
temporal, `UPDATE` de respaldo (`pathname = url` si vacío, la tabla estaba sin
filas), `DROP DEFAULT`, luego los tres índices. Hecha con `prisma migrate diff`
+ `migrate deploy` (sin TTY), aplicada en `travel` y `travel_test`.
`"Document"` ya estaba en `TENANT_MODELS`; sin cambio ahí.

`packages/travel-db/test/tenancy.spec.ts` — un caso más de aislamiento de
`document` (13 → 14 casos).

## 2. Módulo `documents` — `apps/travel-api/src/documents/`

Seis archivos:

```
documents-config.ts     DOCUMENTS.upload.{maxBytes,tokenTtlMs,allowedContentTypes}, .download.urlTtlMs
document-storage.ts     storageEnabled(), createUploadToken(), signedDownloadUrl(), removeObject()
documents.contracts.ts  Zod puro — anchorInput, storageStatusOutput, uploadTokenInput/Output,
                         createDocumentInput, documentListInput, documentEntryOutput (sin pathname/url),
                         downloadUrlOutput, updateDocumentInput, removeManyInput
documents.service.ts    storage/uploadToken/create/list/downloadUrl/update/remove/removeMany
documents.router.ts     @Router({ alias: "documents" }), @UseMiddlewares(AuthMiddleware, AgencyMiddleware)
documents.module.ts
```

Decisiones de implementación:

- **`document-storage.ts` es la capacidad**, en el patrón de
  `apps/agent/agent/lib/capabilities.ts` y `packages/db/src/blob.ts`:
  `import()` dinámico de `@vercel/blob` / `@vercel/blob/client`, y
  `storageEnabled()` lee `TRAVEL_BLOB_READ_WRITE_TOKEN` directo — el token
  nunca se pasa por el `ConfigService` porque el SDK de Vercel lo necesita en
  `process.env` o como argumento explícito en cada llamada.
- **`uploadToken` nunca escribe fila.** Valida `contentType` contra la lista
  blanca, `sizeBytes` contra el máximo, relee el ancla por `agencyDb` (Regla 4
  de `domain.md`: ninguna FK compuesta), arma
  `agencies/<agencyId>/<anchorId>/<uuid>-<filename>` y acuña.
- **`create` verifica el prefijo del `pathname`** contra `agencyId` antes de
  escribir — un llamador no registra un objeto ajeno aunque tenga un
  `pathname` válido de otra agencia.
- **El alcance del `agent`** es un `OR` de tres ramas (subió el archivo, es
  dueño de la reserva anclada, es dueño de la reserva de un pasajero anclado)
  que el servicio agrega al `where`, nunca un input. `canSeeMargins` separa
  "ve todo" de "ve lo suyo", como en `activities` y `commissions`.
- **`update` es más permisivo que `remove`.** Cualquiera que vea la fila puede
  renombrarla o cambiar su `kind`; solo el que subió o un rol con
  `canSeeMargins` puede borrarla. La interfaz refleja esa asimetría: el botón
  Rename no se esconde, el de Remove sí.
- **`documentEntryOutput` no lleva `pathname` ni `url`.** La única vía para
  bajar el archivo es `downloadUrl`, que firma bajo demanda.

`apps/travel-api/src/app.module.ts` gana `DocumentsModule`.
`src/generated/server.ts` se regeneró: **17 routers, 136 procedimientos**.
`test/agency-id-inputs.spec.ts` gana `documentContracts`.

`bookings.byId` y `travelers.byId` ganan `documentCount` (un `_count` en la
misma consulta), como `itemCount`/`travelerCount` y `bookingCount`.

## 3. Recordatorio de documento por vencer

Cierra el riesgo abierto de la Fase 5. Sin cambio de esquema.

- `activities/reminders-config.ts`: `+ travelDocument: { windowDays: 30 }`.
- `activities/reminders.service.ts`: `createTravelDocumentTasks`, cuarto paso
  del barrido. Busca `Traveler` con `documentExpiresAt` en la ventana que
  tenga al menos un `BookingTraveler` de una reserva futura no cancelada; para
  cada uno, escribe una `TASK` asignada al dueño de la reserva más próxima.
- `sourceKey = document-expiry:<travelerId>:<YYYY-MM-DD del vencimiento>` — la
  fecha en la llave es deliberada: un pasaporte renovado vuelve a avisar. Es
  el defecto que `departure:<bookingId>` tiene y que aquí no se repite.
- Misma idempotencia de siempre: `@@unique([agencyId, sourceKey])` +
  `createMany({ skipDuplicates: true })`.

## 4. Variables

Ninguna nueva. `TRAVEL_BLOB_READ_WRITE_TOKEN` ya estaba documentada,
validada como opcional y en los tres `turbo.json` desde la Fase 0.

## 5. Pruebas

`apps/travel-api/test/documents.spec.ts` (nuevo, 12 casos): 503 sin token,
`contentType` fuera de lista, tamaño excedido, ancla de otra agencia, el
`pathname` acuñado lleva el prefijo de la agencia, `create` con `pathname`
ajeno lanza, aislamiento entre agencias, un `agent` no ve el documento de otra
reserva ni el de otro asesor, sí ve el suyo, no puede borrar el ajeno, el
que subió sí puede, y la salida nunca lleva `pathname` ni `url`.

`apps/travel-api/test/reminders.spec.ts`: +2 casos — un pasaporte por vencer
escribe una tarea con el `assignedToId` y el `bookingId` correctos; una
segunda corrida no la duplica.

`packages/travel-db/test/tenancy.spec.ts`: +1 caso.

---

# 7B — La app

Rutas y textos en inglés, como 3A a 6B.

## 1. Dependencia

`apps/travel-app/package.json`: `+ "@vercel/blob": "^2.6.1"`. Solo se importa
`@vercel/blob/client`, código de navegador, sin `pg` ni `dns` en el grafo.

**Nota de implementación:** `put()`, no `upload()`, es la función correcta
para un token ya acuñado por el servidor — `upload()` está pensada para el
flujo donde el propio cliente pide el token a una ruta `handleUploadUrl`, que
este producto no usa.

## 2. Archivos nuevos — `components/travel/documents/`

```
document-meta.ts          DocumentAnchor, DOCUMENT_KINDS, documentKindLabel, formatBytes
documents-panel.tsx       "use client". Props { anchor, viewerId, canManageAll }.
                           Lista + descargar + renombrar + borrar. RenameDialog anidado.
upload-document-dialog.tsx "use client". Ancla fija. El flujo de tres pasos.
document-download.tsx     "use client". useDownloadDocument() — fetchQuery + window.open,
                           nunca guarda la URL en el estado.
```

Sigue el patrón de `commissions-panel.tsx` (panel booking-scoped, dropdown de
acciones por fila) y `commission-dialogs.tsx` (diálogo con la mutación
completa, independiente del sheet de creación de la página).

### El flujo de subida

1. `documents.uploadToken({ ...anchor, filename, contentType, sizeBytes, kind })`
   → `{ token, pathname }`.
2. `put(pathname, file, { access: "private", token, onUploadProgress })` de
   `@vercel/blob/client`. Los bytes van del navegador al almacén.
3. `documents.create({ ...anchor, kind, pathname, url, filename, contentType, sizeBytes })`.
4. `await cache.document(anchor)`.

Si el paso 2 falla, no queda fila. Si el paso 3 falla, queda un blob huérfano
— riesgo abierto, ver más abajo.

`documents.storage` decide si el botón de subir se muestra — el botón y el
503 leen la misma fuente.

**Decisión de props no prevista en el plan original:** `DocumentsPanel` recibe
`viewerId` y `canManageAll` (`canSeeMargins(role)`), no un `canUpload` plano.
Subir es para cualquier miembro — no hay rol que lo restrinja — pero borrar
exige el que subió o un manager, y eso es por fila, no por panel. El botón de
Remove se calcula `canManageAll || row.uploadedBy.id === viewerId`, para que
el botón y el 403 del servicio nunca disientan.

## 3. Pestañas en las fichas

| Archivo | Cambio |
| --- | --- |
| `record-sheet/booking-sheet.tsx` | `+` pestaña `documents` entre `commissions` y `timeline`. `count: data?.documentCount`. `canManageAllDocuments = canSeeMargins(me.data?.role)` |
| `record-sheet/traveler-sheet.tsx` | Reescrito: pasó de `DetailSheetBody` plano a `DetailSheetTabs` con `overview` y `documents`, `useRecordSheetView("overview")` nuevo |

## 4. Página `/documents`

La plantilla de cinco archivos de `commissions/`:

```
app/(app)/[agency]/documents/
  page.tsx                      servidor, requireSession + prefetch + HydrateClient
  documents-search-params.ts    createListSearchParams, faceta kind
  documents-table.tsx           cliente, COLUMNS + useTableQuery; sin columna de acciones
  documents-bulk-actions.tsx    documents.removeMany
  upload-document-sheet.tsx     Sheet por ?new=true; selector de tipo de ancla + selector del registro
```

- **El documento no es un `RecordKind`.** El clic en una fila abre la ficha
  del ancla (`openRecord({ kind, id })` + `setTab("documents")`) — el mismo
  patrón que comisiones abriendo la reserva.
- **Sin columna de acciones en la tabla.** Descargar, renombrar y borrar viven
  en `DocumentsPanel`, dentro de la ficha — la lista es de exploración y
  borrado en lote, igual que comisiones y tareas.
- **La columna "On"** muestra "Booking" o "Traveler", no el folio ni el
  nombre — el mismo límite ya aceptado en la tabla de tareas
  (`docs/travel/status.md`, riesgos de la Fase 5): `documentEntryOutput` no
  trae esas etiquetas.
- **`upload-document-sheet.tsx` duplica el flujo de tres pasos** de
  `upload-document-dialog.tsx` en vez de compartirlo — tiene un selector de
  tipo de ancla y de registro que el diálogo de la ficha no necesita (ahí el
  ancla ya está fija). Es la misma relación que
  `commission-dialogs.tsx`/`create-commission-sheet.tsx` ya tenían.

## 5. Cambios fuera de los archivos nuevos

| Archivo | Cambio |
| --- | --- |
| `apps/travel-app/lib/trpc/cache.ts` | `+ document(anchor?)`; `booking()` y `traveler()` agregan `documents.list` a su lista secundaria |
| `apps/travel-app/components/app-icon-rail.tsx` | `+ { title: "Documents", href: "/documents", icon: DocumentAttachment }` entre Tasks y Settings |
| `apps/travel-app/proxy.ts` | `+ "/documents"` en `SECTIONS` |
| `apps/travel-app/package.json` | `+ @vercel/blob` |

`lib/roles.ts` no cambió: `canSeeMargins` ya estaba re-exportado.

## 6. Verificado

- `bun run check-types` — 22/22 (`next typegen` para la ruta `/documents` nueva).
- `bun run lint` — pasa (mismos warnings de barrel preexistentes:
  `lib/roles.ts`, `postcss.config.mjs`).
- `bun run lint:slop` — pasa.
- `bun run --filter=travel-app build` — pasa. La ruta `/[agency]/documents`
  prerenderiza. Sin `Module not found: dns`. Frontera cliente/servidor limpia.
- `bun run --filter=travel-api test` — 250 casos (223 + 27 nuevos: 12 en
  `documents.spec.ts`, 2 en `reminders.spec.ts`, el resto generado por el
  bucle de `agency-id-inputs.spec.ts` sobre los esquemas nuevos de `documents`).
- `bun run --filter=@travel/db test` — 14 casos (13 + 1 `document`).

### Pendiente de 7B

- El `next dev` real no se ejecutó. `build`, `check-types`, `lint` y
  `lint:slop` sí.
- Recorrido manual con dos cuentas en dos agencias, según la sección
  Verificación de este documento.

---

## Documentación al cerrar

| Archivo | Cambio |
| --- | --- |
| `docs/travel/plan_09.md` | Nuevo — este documento |
| `docs/travel/status.md` | Fases 7A/7B añadidas; `Document` sale de `NOT DONE`; el riesgo "sin recordatorio de documento por vencer" se cierra |
| `docs/travel/api.md` | Sección `documents` router |
| `docs/travel/domain.md` | `Document.pathname` y la regla del prefijo por agencia |
| `.env.example` | Sin cambio — el comentario de `TRAVEL_BLOB_READ_WRITE_TOKEN` ya era correcto |

---

## Verificación

```sh
docker compose up -d
bun install

cd packages/travel-db
bunx prisma migrate deploy && bunx prisma generate
cd ../..

bun run check-types                        # 22/22
bun run lint && bun run lint:slop
bun run --filter=@travel/db test           # 14 casos
bun run --filter=travel-api test           # 250 casos
bun run --filter=travel-app build
bun run dev
```

Recorrido manual, dos cuentas en dos agencias:

1. Subir un PDF a una reserva. Aparece en la pestaña Documents y en `/documents`.
2. Descargar. La URL firmada abre el archivo. Pegarla 10 minutos después falla.
3. Copiar el `id` del documento y pedirlo desde la segunda agencia: `NOT_FOUND`.
4. Entrar como `agent` dueño de otra reserva: el documento no está en su lista.
5. Ese mismo `agent` sube un pasaporte a un pasajero suyo y lo borra. Pasa.
6. Ese `agent` intenta borrar el documento de otro asesor: el botón no está;
   forzando la llamada, `FORBIDDEN`.
7. Subir un `.exe`: el diálogo lo rechaza antes de pedir el token.
8. Quitar `TRAVEL_BLOB_READ_WRITE_TOKEN` y reiniciar: el botón de subir
   desaparece; la lista y la descarga siguen.
9. Poner `documentExpiresAt` de un pasajero a 15 días y correr
   `POST /internal/sync/reminders`: nace una tarea. Correr otra vez: `created: 0`.

---

## Issues

1. RISK — Un fallo entre el paso 2 y el paso 3 de la subida deja un blob sin
   fila. El almacén crece.
   Fix: no hecho. Necesita un barrido que compare `list()` del almacén contra
   la tabla.
2. RISK — El token de subida acota ruta, tipo y tamaño, pero el almacén no
   verifica el contenido. Un `.exe` renombrado a `.pdf` entra.
   Fix: no hecho. Necesita revisar los primeros bytes del archivo.
3. RISK — `medicalNotes`, `dietaryNotes` y `documentNumber` siguen en claro.
   Un pasaporte escaneado ahora vive en el almacén, cifrado en reposo por el
   proveedor, pero la fila que lo describe no lo está.
   Fix: no hecho. Es el riesgo 4 de `status.md`, sin cerrar.
4. NOT DONE — Sin antivirus y sin límite de peticiones en `uploadToken`. Un
   miembro válido acuña tokens sin tope.
   Fix: no hecho.
5. NOT DONE — Sin vista previa en la app. El documento se descarga, no se ve
   en línea.
6. NOT DONE — La columna "On" de la tabla de documentos y el campo "Attach to"
   del sheet de subida no muestran folio ni nombre, solo "Booking"/"Traveler".
   `documentEntryOutput` no trae esas etiquetas. Mismo límite que la tabla de
   tareas.
7. UNKNOWN — El flujo completo no se probó contra un almacén Vercel Blob real
   en esta sesión, ni el `next dev` real. La API del paquete instalado sí se
   leyó y el `.spec.ts` cubre la lógica del servicio contra Postgres real.
   Fix: el recorrido manual de la sección Verificación lo mide.
