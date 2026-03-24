# QA Matrix V1 de resolución de contraparte

Fecha: 2026-03-24  
Estado: lista para gate de release  
Ámbito: TaxHacker España, flujo conservador de resolución de contraparte

## 1. Objetivo

Definir el gate mínimo antes de considerar estable el flujo V1 de resolución de contraparte.

La matriz cubre:

- auto-link conservador por NIF exacto
- revisión manual desde detalle de transacción
- copy y CTA de la cola fiscal
- endurecimiento específico de alquiler con retención
- auditoría
- backfill en `dry-run`

No cubre:

- fuzzy matching
- UX masiva
- multiempresa
- SII

## 2. Matriz de aceptación

| Escenario | Fuente de verdad | Resultado esperado | Gate |
| --- | --- | --- | --- |
| Factura recibida con NIF exacto y única contraparte activa | `models/fiscal/counterparty-resolution.ts`, `models/fiscal/sync.ts` | `decision=auto_linked`, se rellena `counterparty_id`, se audita `counterparty_auto_linked` | Obligatorio |
| Factura recibida sin vínculo canónico pero con dato fiscal suficiente | `models/fiscal/review-status.ts` | puede seguir lista o en revisión según flujo, pero no se bloquea solo por faltar `counterparty_id` | Obligatorio |
| Factura simplificada sin vínculo canónico seguro | política V1 | no hay `auto-link` difuso, queda sugerencia o revisión, nunca autoenlace por nombre | Obligatorio |
| Duplicado por NIF o candidata inactiva | `models/fiscal/counterparty-resolution.ts` | no hay `auto-link`, se conserva revisión y se informa conflicto | Obligatorio |
| Confirmación manual desde panel fiscal | `app/(app)/transactions/fiscal-actions.ts` | enlaza contraparte elegida, conserva evidencia fiscal y audita confirmación manual | Obligatorio |
| Crear y enlazar contraparte nueva | `app/(app)/transactions/fiscal-actions.ts` | crea contraparte, enlaza y audita `counterparty_created_and_linked` | Obligatorio |
| Mantener en revisión | `app/(app)/transactions/fiscal-actions.ts` | no escribe vínculo canónico nuevo y audita `counterparty_kept_in_review` | Obligatorio |
| Cola fiscal con falta de vínculo canónico | `models/fiscal/review-queue.ts`, `components/tax/review/review-queue-list.tsx` | muestra `Acción pendiente`, resumen de resolución y CTA correcto | Obligatorio |
| Alquiler con retención sin `counterparty_id` | `models/fiscal/review-status.ts` | sigue en `needs_review`, no en `blocked` | Obligatorio |
| Alquiler con retención sin `counterparty_tax_id` | `models/fiscal/review-status.ts` | pasa a `blocked` | Obligatorio |
| Backfill en `dry-run` | `scripts/backfill-counterparty-resolution.ts` | no escribe, resume `autoLinked`, `stillInReview`, `conflictsFound` y `applied=0` | Obligatorio |
| Backfill con `--apply` | `scripts/backfill-counterparty-resolution.ts` | solo aplica casos `auto_linked` y emite auditoría | Recomendado antes de rollout amplio |

## 3. Comandos obligatorios

### 3.1 Suite focal de contraparte

```bash
node --test --experimental-strip-types \
  tests/scripts/backfill-counterparty-resolution.test.mjs \
  tests/models/fiscal/sync.test.mjs \
  tests/app/transactions/fiscal-actions.test.mjs \
  tests/models/fiscal/audit-log.test.mjs \
  tests/models/fiscal/review-status.test.mjs \
  tests/models/fiscal/review-queue.test.mjs \
  tests/models/tax-forms/model-115.test.mjs \
  tests/app/tax-review-request-flow.test.mjs \
  tests/app/tax-review-queue-copy.test.mjs
```

Resultado esperado:

- exit code `0`
- ningún test fallido
- se valida:
  - auto-link seguro
  - auditoría
  - copy de review queue
  - edge cases de `115/180`
  - backfill en `dry-run` y `apply`

### 3.2 Lint del write set

```bash
npx eslint \
  'scripts/backfill-counterparty-resolution.ts' \
  'models/fiscal/sync.ts' \
  'models/fiscal/review-status.ts' \
  'models/fiscal/review-queue.ts' \
  'app/(app)/transactions/fiscal-actions.ts' \
  'app/(app)/transactions/fiscal-panel-shared.ts' \
  'components/tax/review/review-queue-list.tsx' \
  'components/tax/review/review-status-badge.tsx' \
  'lib/i18n/messages.ts' \
  'tests/scripts/backfill-counterparty-resolution.test.mjs' \
  'tests/app/transactions/fiscal-actions.test.mjs' \
  'tests/models/fiscal/sync.test.mjs' \
  'tests/models/fiscal/review-status.test.mjs' \
  'tests/models/fiscal/review-queue.test.mjs' \
  'tests/app/tax-review-queue-copy.test.mjs'
```

Resultado esperado:

- exit code `0`
- sin errores de lint

### 3.3 Tipado

```bash
npx tsc --noEmit --pretty false
```

Resultado esperado:

- exit code `0`
- sin errores de compilación TypeScript

## 4. Checklist manual de smoke

### 4.1 Detalle de transacción

Preparación:

- abrir una transacción con `missing_counterparty_relation`
- confirmar que existe al menos una contraparte con NIF exacto

Pasos:

1. abrir el panel fiscal
2. confirmar una contraparte existente
3. guardar
4. recargar la página

Resultado esperado:

- el `counterparty_id` queda enlazado
- el nombre y NIF observados del documento no se sobrescriben
- la transacción deja de presentar la acción manual anterior si ya no aplica

### 4.2 Cola fiscal

Pasos:

1. abrir `/tax/review`
2. localizar un documento con incidencia de contraparte
3. revisar el bloque `Acción pendiente`
4. revisar el bloque `Resolución de contraparte`
5. usar el CTA principal

Resultado esperado:

- el copy ya no usa wording ambiguo
- el CTA apunta a resolución fiscal cuando toca
- un conflicto visible no se presenta como auto-link seguro

### 4.3 Alquiler con retención

Pasos:

1. abrir un documento de alquiler con retención
2. dejar vacío `counterparty_id`
3. verificar el estado
4. dejar vacío `counterparty_tax_id`
5. verificar de nuevo el estado

Resultado esperado:

- sin `counterparty_id`: `needs_review`
- sin `counterparty_tax_id`: `blocked`

### 4.4 Backfill

Pasos:

1. ejecutar:

```bash
npm run fiscal:backfill-counterparty-resolution -- --owner-scope-id <ownerScopeId>
```

2. revisar el resumen
3. repetir con `--apply` solo en entorno controlado

Resultado esperado en `dry-run`:

- no hay escrituras
- el resumen distingue:
  - `Auto-link seguros detectados`
  - `Siguen en revisión`
  - `Conflictos detectados`

Resultado esperado en `apply`:

- solo se aplican casos `auto_linked`
- el número de `Aplicados` coincide con los auto-links seguros realmente ejecutados

## 5. Gate final de release

No considerar listo para merge amplio si falta cualquiera de estos puntos:

- suite focal en verde
- lint en verde
- `tsc` en verde
- review técnica del write set completada
- smoke manual del detalle de transacción completado
- backfill revisado al menos en `dry-run`

## 6. Estado del gate a 2026-03-24

- suite focal: completada
- lint: completado
- `tsc`: completado
- review técnica: completada
- smoke del detalle de transacción: completado vía `tests/e2e/counterparty-resolution-smoke.spec.ts`
- backfill en fixture/dry-run: completado
