# Mobile Phase 1 Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar la fase 1 del canal móvil dejando coherente el estado tras `Aceptar`, los contadores del inbox y la continuidad móvil-escritorio.

**Architecture:** el remate no cambia el producto ni añade PWA. Se limita a consolidar `File.metadata.mobileTriage` como estado de continuidad y a alinear `review`, `inbox` y `accept` sobre la misma verdad persistida. El cierre se valida con tests dirigidos y una repetición manual del flujo real en self-hosted.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, `node:test`, Playwright MCP/browser-debugger.

---

## Estado de partida

- Validación real ya confirmada:
  - `capture -> inbox -> review -> aceptar` funciona con un PDF real y crea una `Transaction`
  - la subida y análisis de un PDF no factura funciona y termina en `ready_for_review` con `low_confidence`
- Nuevo hallazgo de validación real:
  - existe al menos otro caso real con `ready_for_review` y `Aceptar` habilitado que falla al guardar con `Failed to save transaction: TypeError: Cannot read properties of undefined (reading 'trim')`
  - esto ocurrió en el flujo móvil real, no solo en test
- Hallazgo residual confirmado en base de datos:
  - el `File` aceptado `06d60fa5-362e-4fb9-a1fc-7d50ce75358f` quedó con `isReviewed = true`
  - existe la transacción `500f0244-c5a7-4183-a29b-1e2ba3a041ae`
  - pero `File.metadata.mobileTriage.disposition` sigue en `"pending"`
- Conclusión: la fase 1 móvil es funcional, pero no está cerrada hasta:
  - hacer robusto el guardado real de `accept`
  - limpiar la inconsistencia de `mobileTriage`
  - blindar ambos con tests

## Ejecución recomendada

- Orden: `Task 0 -> Task 1 -> Task 2 -> Task 3 -> Task 4`
- Revisión tras cada tarea:
  - `reviewer`
  - modelo: `gpt-5.4`
  - razonamiento: `high`
  - skills: `requesting-code-review`
- `ORCHESTRATOR.md` lo actualiza el orquestador cuando el bloque quede aprobado; los implementadores no lo tocan.

### Task 0: Hacer robusto el guardado real de `Aceptar`

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Responsabilidad**
- Corregir el fallo real en el que `Aceptar` desde quick review móvil revienta con:
  - `Failed to save transaction: TypeError: Cannot read properties of undefined (reading 'trim')`
- El objetivo aquí no es “tapar el error”, sino localizar la causa raíz en el camino de guardado y dejar un test que la cubra.

**Contexto confirmado**
- caso real observado: `fileId = 9593db8c-3188-4de1-b9b7-dc8d49db4a16`
- la review móvil estaba en `ready_for_review`
- `Aceptar` estaba habilitado
- el error se envolvía en `saveFileAsTransactionAction()` dentro de `app/(app)/unsorted/actions.ts`

**Files**
- Modify: `app/(app)/capture/review/[fileId]/review-actions-core.ts`
- Modify: `app/(app)/unsorted/actions.ts`
- Modify: `forms/transactions.ts`
- Modify: `models/fiscal/sync.ts`
- Test: `tests/app/capture/review-actions.test.mjs`

**Must not touch**
- `models/mobile/inbox.ts`
- `app/api/mobile/*`
- `ORCHESTRATOR.md`

- [ ] **Step 1: Reproducir el fallo con un test**

Crear o ampliar un test que cubra:
- quick review móvil con datos válidos
- camino de `saveFileAsTransactionAction`
- caso con valor ausente o shape real que hoy acaba en `trim` sobre `undefined`

- [ ] **Step 2: Ejecutar rojo**

Run:
```bash
node --test --experimental-strip-types tests/app/capture/review-actions.test.mjs
```

- [ ] **Step 3: Corregir la causa raíz**

Reglas:
- no meter un `try/catch` cosmético para ocultar el problema
- localizar el valor que llega roto y normalizarlo en el punto correcto
- no romper el flujo feliz ya validado

- [ ] **Step 4: Ejecutar verde**

Run:
```bash
node --test --experimental-strip-types tests/app/capture/review-actions.test.mjs
```

- [ ] **Step 5: Verificación del write set**

Run:
```bash
npx eslint 'app/(app)/capture/review/[fileId]/review-actions-core.ts' 'app/(app)/unsorted/actions.ts' 'forms/transactions.ts' 'models/fiscal/sync.ts' 'tests/app/capture/review-actions.test.mjs'
npx tsc --noEmit --pretty false
```

### Task 1: Normalizar el estado terminal tras `Aceptar`

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Responsabilidad**
- Al aceptar desde quick review, el fichero aceptado no puede seguir marcado como `mobileTriage.disposition = "pending"`.
- Debe quedar en un estado terminal limpio y coherente con `isReviewed = true` y con la transacción creada.

**Files**
- Modify: `app/(app)/capture/review/[fileId]/review-actions-core.ts`
- Modify: `app/(app)/capture/review/[fileId]/actions.ts`
- Modify: `lib/mobile-triage.ts`
- Test: `tests/app/capture/review-actions.test.mjs`

**Must not touch**
- `app/api/mobile/*`
- `models/mobile/inbox.ts`
- `ORCHESTRATOR.md`

- [ ] **Step 1: Escribir el test que falla para aceptación limpia**

Cubrir este caso:
- `accept` crea transacción
- `File.isReviewed = true`
- `File.metadata.mobileTriage` deja de quedar en `pending`

- [ ] **Step 2: Ejecutar el test rojo**

Run:
```bash
node --test --experimental-strip-types tests/app/capture/review-actions.test.mjs
```

- [ ] **Step 3: Implementar el cambio mínimo**

Regla:
- tras `accept`, limpiar `mobileTriage` o marcarlo en un estado terminal que el inbox nunca cuente como pendiente
- no romper `deferred` ni `analysis_failed`

- [ ] **Step 4: Verificar el test verde**

Run:
```bash
node --test --experimental-strip-types tests/app/capture/review-actions.test.mjs
```

- [ ] **Step 5: Verificación del write set**

Run:
```bash
npx eslint 'app/(app)/capture/review/[fileId]/review-actions-core.ts' 'app/(app)/capture/review/[fileId]/actions.ts' 'lib/mobile-triage.ts' 'tests/app/capture/review-actions.test.mjs'
npx tsc --noEmit --pretty false
```

### Task 2: Alinear inbox, contadores y filtros con la misma verdad

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Responsabilidad**
- El inbox móvil y sus contadores no deben considerar pendiente un fichero ya aceptado.
- Los estados derivados deben salir de la misma fuente de verdad que usa `accept`.

**Files**
- Modify: `models/mobile/inbox.ts`
- Modify: `models/mobile/capture.ts`
- Modify: `lib/mobile-triage.ts`
- Test: `tests/models/mobile/inbox.test.mjs`
- Test: `tests/models/mobile/capture.test.mjs`

**Must not touch**
- `app/(app)/capture/review/[fileId]/*`
- `app/api/mobile/capture/*`
- `ORCHESTRATOR.md`

- [ ] **Step 1: Escribir tests de regresión para contador y filtrado**

Cubrir estos casos:
- fichero aceptado no aparece en inbox
- contador de pendientes baja tras `accept`
- `deferred` y `analysis_failed` siguen funcionando como antes

- [ ] **Step 2: Ejecutar rojo**

Run:
```bash
node --test --experimental-strip-types tests/models/mobile/inbox.test.mjs tests/models/mobile/capture.test.mjs
```

- [ ] **Step 3: Ajustar derivación de estados**

Reglas:
- un `File` con `isReviewed = true` nunca cuenta como pendiente móvil
- el inbox no debe depender de literales ambiguos ni de metadata obsoleta
- el filtro debe ser compatible con los estados reales del flujo actual

- [ ] **Step 4: Ejecutar verde**

Run:
```bash
node --test --experimental-strip-types tests/models/mobile/inbox.test.mjs tests/models/mobile/capture.test.mjs
```

- [ ] **Step 5: Verificación del write set**

Run:
```bash
npx eslint 'models/mobile/inbox.ts' 'models/mobile/capture.ts' 'lib/mobile-triage.ts' 'tests/models/mobile/inbox.test.mjs' 'tests/models/mobile/capture.test.mjs'
npx tsc --noEmit --pretty false
```

### Task 3: Blindar el cierre con tests cruzados

**Subagente**
- tipo: `test-automator`
- modelo: `gpt-5.3-codex-spark`
- razonamiento: `medium`
- skills: `test-driven-development`, `verification-before-completion`

**Responsabilidad**
- Añadir cobertura cruzada para que no reaparezca la inconsistencia entre `accept`, `mobileTriage` e inbox.

**Files**
- Modify: `tests/app/capture/review-actions.test.mjs`
- Modify: `tests/models/mobile/inbox.test.mjs`
- Modify: `tests/models/mobile/triage.test.mjs`

**Must not touch**
- código de producción
- `app/api/*`
- `ORCHESTRATOR.md`

- [ ] **Step 1: Añadir escenario end-to-end lógico**

Caso esperado:
- documento móvil en `pending`
- `accept`
- `isReviewed = true`
- estado de continuidad ya no pendiente
- el inbox no lo devuelve

- [ ] **Step 2: Añadir escenario de compatibilidad**

Caso esperado:
- `deferred_to_desktop` sigue visible donde toca
- `analysis_failed` sigue sobreviviendo al refresh

- [ ] **Step 3: Ejecutar suite dirigida**

Run:
```bash
node --test --experimental-strip-types tests/app/capture/review-actions.test.mjs tests/models/mobile/inbox.test.mjs tests/models/mobile/triage.test.mjs
```

- [ ] **Step 4: Verificación del write set**

Run:
```bash
npx eslint 'tests/app/capture/review-actions.test.mjs' 'tests/models/mobile/inbox.test.mjs' 'tests/models/mobile/triage.test.mjs'
```

### Task 4: Revalidación manual real del remate

**Subagente**
- tipo: `browser-debugger`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `verification-before-completion`

**Responsabilidad**
- Repetir la validación manual del canal móvil tras las correcciones.

**Files**
- No code changes

**Must not touch**
- todo el código del repo

- [ ] **Step 1: Validar `accept` real**

En self-hosted:
- entrar por `/capture`
- subir un PDF real
- esperar `ready_for_review`
- aceptar desde quick review
- confirmar que desaparece del inbox y no queda pendiente

- [ ] **Step 2: Validar flujo PDF no factura**

- subir un PDF no factura
- confirmar `ready_for_review` con `low_confidence` o estado equivalente accionable
- confirmar ausencia de errores silenciosos

- [ ] **Step 3: Confirmar evidencias**

Recoger:
- URLs finales
- estados observados
- si el contador baja correctamente tras `accept`
- cualquier síntoma residual

## Verificación final integrada

Cuando Tasks 1-3 estén aprobadas:

```bash
node --test --experimental-strip-types tests/app/capture/review-actions.test.mjs tests/models/mobile/inbox.test.mjs tests/models/mobile/capture.test.mjs tests/models/mobile/triage.test.mjs tests/app/api/mobile/inbox.test.mjs tests/app/capture/routes.test.mjs tests/models/uploads.test.mjs tests/app/api/uploads.test.mjs tests/components/upload-widgets.test.mjs
npx eslint 'app/(app)/capture/review/[fileId]/review-actions-core.ts' 'app/(app)/capture/review/[fileId]/actions.ts' 'models/mobile/inbox.ts' 'models/mobile/capture.ts' 'lib/mobile-triage.ts' 'tests/app/capture/review-actions.test.mjs' 'tests/models/mobile/inbox.test.mjs' 'tests/models/mobile/capture.test.mjs' 'tests/models/mobile/triage.test.mjs'
npx tsc --noEmit --pretty false
npm run build
```

## Criterio de cierre

La fase 1 móvil solo se considera cerrada si se cumplen todos:

- `accept` móvil crea transacción y no deja `mobileTriage` en `pending`
- el documento aceptado desaparece del inbox
- el contador de pendientes baja de forma coherente
- el PDF no factura sigue cayendo en revisión accionable y no en error silencioso
- tests dirigidos, lint, tipos y build pasan

## Siguiente fase solo después de cerrar esto

- `PWA` instalable
- `manifest` e iconos
- acceso más directo a captura

Fuera de alcance todavía:
- offline-first
- background sync
- share target
- `getUserMedia` como base del flujo
