# Spanish S.L. Fiscal Control Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** convertir TaxHacker en la torre de control colaborativa del cierre fiscal recurrente de una S.L. española estándar, con `303` y `115` reales como núcleo, colaboración asesoría-cliente, expediente de presentación y una capa anual ligera de handoff.

**Architecture:** se conserva el dominio fiscal ya construido y se evita abrir frentes de ERP, nómina o contabilidad general. El trabajo se organiza por `obligación fiscal` y no por “pantallas”: cada obligación debe tener `readiness`, `bloqueos`, `responsable`, `borrador`, `estado de presentación` y `archivo`. El primer bloque cierra `303/115` de verdad sobre datos reales y el segundo añade operación colaborativa y salida anual ligera.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, Server Actions, modelos en `models/*`, tests Node, Playwright/manual browser validation.

---

## Estado actual y cierre

Plan ejecutado de punta a punta a fecha de `2026-03-23`.

- Núcleo ya aterrizado en producto:
  - `303` real
  - `115` real
  - registro de obligaciones por periodo
  - expediente de presentación
  - colaboración asesoría-cliente
  - `111` manual
  - capa anual ligera con `180`, `390`, `347`, `349`, `200_handoff` y `202_handoff`
  - seguimiento manual del `handoff anual` con persistencia real de `status`, `owner` y `notes`
  - ítems mercantiles anuales integrados en `fiscal_obligations`, no en un estado paralelo
- `VERI*FACTU` queda documentado como gate de producto separado y no bloquea el core trimestral.
- El cierre de `Phase 7` queda validado con smoke E2E real sobre:
  - cockpit fiscal
  - `303`
  - `115`
  - incidencia colaborativa
  - expediente de presentación
  - archivo trimestral
- Las checklists inferiores se conservan como desglose original de ejecución; el estado consolidado vivo está en `ORCHESTRATOR.md`.
- Verificación fresca del cierre final:
  - `npx playwright test tests/e2e/fiscal-obligations-smoke.spec.ts tests/e2e/fiscal-collaboration-smoke.spec.ts` OK
  - `node --test --experimental-strip-types tests/components/tax/obligations-cockpit.test.mjs tests/models/fiscal/obligations.test.mjs tests/models/fiscal/annual-handoff.test.mjs` OK
  - `npx eslint playwright.config.ts tests/e2e/helpers/auth.ts tests/e2e/helpers/env.ts tests/e2e/helpers/fiscal-smoke-fixture.ts tests/e2e/fiscal-obligations-smoke.spec.ts tests/e2e/fiscal-collaboration-smoke.spec.ts` OK
  - `npx eslint models/fiscal/obligations.ts tests/models/fiscal/obligations.test.mjs tests/e2e/fiscal-obligations-smoke.spec.ts` OK
  - `npx prisma validate` OK
  - `npx prisma generate` OK
  - `npm run build` OK
  - `npx tsc --noEmit --pretty false` OK

## Product Thesis

- ICP confirmado:
  - S.L. española pequeña o mediana
  - ejercicio natural
  - IVA trimestral
  - fuera de SII y REDEME
  - casuística fiscal estándar
  - asesoría que persigue documentación y presenta modelos recurrentes
  - cliente que sube papeles, corrige incidencias y cierra trimestre con la asesoría
- Propuesta de valor:
  - que ninguna obligación recurrente se rompa por falta de contexto, evidencia o seguimiento
  - que el cierre trimestral quede `listo, defendible y trazable`
- Norte funcional:
  - `readiness por obligación`
  - `expediente de presentación`
  - `colaboración asesoría-cliente`
  - `archivo anual`

## Scope

### In Scope

- `303` real sobre datos del tenant
- `115` real sobre datos del tenant
- `cockpit de obligaciones`
- `expediente de presentación`
- `responsable, bloqueos, evidencias y estado`
- `colaboración asesoría-cliente`
- `111` manual
- `180`, `390`, `347`, `349` como capa posterior derivada del mismo núcleo
- `advisor handoff anual` para `200/202`, cuentas y mercantil
- track condicional de `VERI*FACTU` si la facturación propia se convierte en producto prioritario

### Out of Scope

- nómina
- Seguridad Social
- `190`
- contabilidad general
- automatización real de `200/202`
- cuentas anuales automatizadas
- SII, REDEME, intracomunitaria avanzada, regímenes especiales complejos

## Existing Assets To Reuse

- Dominio fiscal base:
  - `models/fiscal/profile.ts`
  - `models/fiscal/transaction-fiscal.ts`
  - `models/fiscal/review-status.ts`
  - `models/fiscal/review-queue.ts`
  - `models/fiscal/assignment-engine.ts`
  - `models/fiscal/periods.ts`
  - `models/fiscal/quarterly-draft.ts`
  - `models/fiscal/vat-books.ts`
  - `models/fiscal/legal-archive.ts`
  - `models/fiscal/close.ts`
  - `models/fiscal/audit-log.ts`
- Workspace fiscal:
  - `app/(app)/tax/page.tsx`
  - `app/(app)/tax/quarters/*`
  - `app/(app)/tax/review/page.tsx`
  - `app/(app)/tax/forms/*`
  - `app/(app)/tax/archive/*`
  - `app/(app)/tax/close/*`
  - `app/(app)/tax/counterparties/*`
- Vistas existentes:
  - `components/tax/forms/303/model-303-draft-view.tsx`
  - `components/tax/forms/115/model-115-draft-view.tsx`
  - `components/tax/review/*`
  - `components/tax/quarters/*`
  - `components/tax/archive/*`
  - `components/tax/layout/*`
- Contratos ya cerrados:
  - `docs/superpowers/specs/2026-03-21-fiscal-domain-contract.md`
  - `docs/superpowers/specs/2026-03-21-model-111-scope.md`
  - `docs/superpowers/specs/2026-03-21-golden-quarter-dataset.md`
  - `docs/superpowers/specs/2026-03-21-verifactu-track.md`
  - `docs/superpowers/specs/2026-03-22-obligation-assignment-delta.md`

## Delivery Rules

- Skills de orquestación:
  - `writing-plans`
  - `subagent-driven-development`
  - `requesting-code-review`
- Skills obligatorias de implementación:
  - `test-driven-development`
  - `verification-before-completion`
- Skills obligatorias cuando aplique:
  - `brainstorming` para contratos funcionales delicados
  - `systematic-debugging` para cualquier desfase entre dominio y UI
  - `nextjs-15` para App Router, loaders y Server Actions
  - `react-19` para superficies interactivas
  - `typescript` para resolvedores y contratos
- Cada fase debe cerrar con:
  - tests del write set
  - `eslint` del write set
  - `npx prisma validate` y `npx prisma generate` cuando toque Prisma
  - `npx tsc --noEmit --pretty false`
  - `npm run build`
  - smoke manual del flujo afectado

## Phase 0: Freeze The Obligation Model

### Task 0.1: Operating Contract Per Obligation

**Subagente**
- tipo: `business-analyst`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-obligation-workflow-contract.md`
- Create: `docs/superpowers/specs/2026-03-23-fiscal-icp-and-scope.md`

**Must not touch**
- `app/*`
- `components/*`
- `models/*`
- `prisma/*`

- [ ] Definir el workflow canónico por obligación:
  - `not_applicable`
  - `waiting_on_documents`
  - `needs_review`
  - `ready_to_prepare`
  - `draft_ready`
  - `ready_to_file`
  - `filed`
  - `archived`
- [ ] Congelar campos operativos obligatorios por obligación:
  - `dueDate`
  - `owner`
  - `blockingReasons`
  - `requiredEvidence`
  - `filingReference`
  - `filedAt`
  - `filedBy`
- [ ] Cerrar el ICP exacto y qué casuística fiscal queda fuera.
- [ ] Congelar que `200/202` y cuentas van como `handoff anual`, no como motor automático.

### Task 0.2: Presentation Dossier Contract

**Subagente**
- tipo: `product-manager`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-presentation-dossier-contract.md`

**Must not touch**
- código del producto

- [ ] Definir el expediente de presentación mínimo:
  - borrador
  - detalle trazable
  - evidencias soporte
  - checklist
  - justificante
  - CSV/NRC/acuse
- [ ] Definir qué parte hace cliente y qué parte asesoría.
- [ ] Definir diferencias entre:
  - `presentado dentro de la app`
  - `presentado fuera y archivado en la app`

## Phase 1: Fiscal Profile And Obligation Registry

### Task 1.1: Fiscal Profile V2

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`, `typescript`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_expand_fiscal_profile_and_obligations/migration.sql`
- Modify: `models/fiscal/profile.ts`
- Modify: `app/(app)/settings/fiscal/page.tsx`
- Create: `tests/models/fiscal/profile-v2.test.mjs`

**Must not touch**
- `models/tax-forms/*`
- `components/ui/*`

- [ ] Añadir flags operativos de perfil fiscal:
  - `hasEmployees`
  - `hasRentWithholding`
  - `hasProfessionalWithholding`
  - `hasIntraEuOperations`
  - `isVatCashAccountingEnabled`
  - `issuesInvoices`
  - `annualCloseMonth`
- [ ] Escribir tests rojos para validación y bootstrap de estos campos.
- [ ] Migrar Prisma y adaptar lectura/escritura del perfil.
- [ ] Ajustar settings fiscal para editar el perfil operativo.
- [ ] Verificar que tenants existentes no rompen y reciben defaults seguros.

### Task 1.2: Obligation Registry

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_add_tax_obligations/migration.sql`
- Create: `models/fiscal/obligations.ts`
- Create: `tests/models/fiscal/obligations.test.mjs`

**Must not touch**
- `app/(app)/tax/forms/*`
- `components/tax/forms/*`

- [ ] Crear entidad/registro operativo de obligación fiscal por `organizationId` y periodo.
- [ ] Modelar obligaciones mínimas:
  - `303`
  - `115`
  - `111_manual`
  - `180`
  - `390`
  - `347`
  - `349`
  - `200_handoff`
  - `202_handoff`
- [ ] Calcular aplicabilidad desde el perfil fiscal y el periodo.
- [ ] Exponer resolvedor `listObligationsForPeriod` y `getObligationStatus`.
- [ ] Mantener `not_applicable` fuera del ruido principal de la UI.

## Phase 2: Real 303 And 115

### Task 2.1: Real Tenant-Backed 303 Draft

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `nextjs-15`, `verification-before-completion`

**Files**
- Modify: `models/tax-forms/model-303.ts`
- Create: `models/tax-forms/model-303-loader.ts`
- Modify: `app/(app)/tax/forms/303/page.tsx`
- Modify: `components/tax/forms/303/model-303-draft-view.tsx`
- Create: `tests/models/tax-forms/model-303-loader.test.mjs`
- Modify: `tests/models/tax-forms/model-303.test.mjs`

**Must not touch**
- `models/fiscal/profile.ts`
- `app/(app)/tax/forms/115/*`

- [ ] Escribir tests rojos para cargar el borrador `303` desde facts fiscales reales del tenant.
- [ ] Sustituir el uso de `golden-quarter.json` por carga real de periodo activo o seleccionado.
- [ ] Mantener el fixture solo como test oracle, no como fuente del runtime.
- [ ] Añadir metadatos de readiness:
  - documentos incluidos
  - documentos bloqueados
  - casillas pendientes de soporte
- [ ] Verificar que el 303 no cae cuando el trimestre existe pero está vacío o incompleto.

### Task 2.2: Real Tenant-Backed 115 Draft

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `nextjs-15`, `verification-before-completion`

**Files**
- Modify: `models/tax-forms/model-115.ts`
- Create: `models/tax-forms/model-115-loader.ts`
- Modify: `app/(app)/tax/forms/115/page.tsx`
- Modify: `components/tax/forms/115/model-115-draft-view.tsx`
- Create: `tests/models/tax-forms/model-115-loader.test.mjs`
- Modify: `tests/models/tax-forms/model-115.test.mjs`

**Must not touch**
- `models/tax-forms/model-303.ts`
- `app/(app)/tax/forms/303/*`

- [ ] Escribir tests rojos para cargar el `115` desde el trimestre y el tenant real.
- [ ] Sustituir fixture por loader real.
- [ ] Mostrar perceptores, bases, cuotas y readiness documental.
- [ ] Preparar el terreno para `180` anual reutilizando los mismos agregados.

### Task 2.3: Counterparty Quality Gate

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `models/fiscal/counterparties.ts`
- Modify: `models/fiscal/counterparty-resolution.ts`
- Modify: `models/fiscal/review-status.ts`
- Modify: `app/(app)/tax/counterparties/page.tsx`
- Create: `tests/models/fiscal/counterparty-quality-gate.test.mjs`

**Must not touch**
- `models/tax-forms/*`
- `app/(app)/tax/forms/*`

- [ ] Bloquear `115`, `180`, `347` y `349` cuando la contraparte/NIF no sea fiable.
- [ ] Hacer explícito en la review queue el motivo y la obligación afectada.
- [ ] Añadir señales de calidad de tercero reutilizables por varios modelos.

## Phase 3: Presentation Dossier And Filing State

### Task 3.1: Filing Dossier Storage

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`, `typescript`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_add_tax_filing_dossiers/migration.sql`
- Create: `models/fiscal/filing-dossiers.ts`
- Create: `tests/models/fiscal/filing-dossiers.test.mjs`

**Must not touch**
- `components/tax/forms/*`
- `app/(app)/tax/review/*`

- [ ] Crear storage de expediente por obligación y periodo.
- [ ] Persistir:
  - `draftSnapshot`
  - `evidenceManifest`
  - `checklistState`
  - `filingReference`
  - `filedAt`
  - `filedByUserId`
  - `filingNotes`
- [ ] Hacer idempotente la actualización del expediente.

### Task 3.2: Filing State UI

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `react-19`, `nextjs-15`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `components/tax/forms/shared/filing-dossier-card.tsx`
- Modify: `components/tax/forms/303/model-303-draft-view.tsx`
- Modify: `components/tax/forms/115/model-115-draft-view.tsx`
- Create: `app/(app)/tax/forms/[obligationCode]/evidence/actions.ts`
- Create: `tests/components/tax/filing-dossier-card.test.mjs`

**Must not touch**
- `components/ui/*`
- `models/fiscal/transaction-fiscal.ts`

- [ ] Añadir panel común de expediente en `303` y `115`.
- [ ] Permitir marcar:
  - `draft_ready`
  - `ready_to_file`
  - `filed`
- [ ] Permitir adjuntar justificante y referencia externa.
- [ ] Mantener exactamente la estética actual.

### Task 3.3: Archive Integration

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `models/fiscal/legal-archive.ts`
- Modify: `app/(app)/tax/archive/[periodId]/page.tsx`
- Modify: `components/tax/archive/archive-manifest-view.tsx`
- Create: `tests/models/fiscal/legal-archive-filings.test.mjs`

**Must not touch**
- `models/tax-forms/*`

- [ ] Integrar el expediente de presentación dentro del archivo trimestral.
- [ ] Mostrar borradores, justificantes y huecos de trazabilidad dentro del manifiesto.

## Phase 4: Collaboration Advisory-Client

### Task 4.1: Review Requests And Ownership

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `nextjs-15`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_add_tax_review_requests/migration.sql`
- Create: `models/fiscal/review-requests.ts`
- Modify: `models/fiscal/review-queue.ts`
- Modify: `app/(app)/tax/review/page.tsx`
- Modify: `components/tax/review/review-queue-list.tsx`
- Create: `tests/models/fiscal/review-requests.test.mjs`

**Must not touch**
- `models/tax-forms/*`
- `app/(app)/ops/*`

- [ ] Añadir solicitud/incidencia fiscal con:
  - responsable
  - tipo de actor (`cliente` o `asesoría`)
  - mensaje
  - fecha límite
  - estado
- [ ] Integrar estas incidencias en la cola fiscal sin romper el dominio actual.
- [ ] Hacer visible quién tiene la pelota en cada bloqueo.

### Task 4.2: Obligation Cockpit

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `react-19`, `nextjs-15`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `components/tax/obligations/obligations-cockpit.tsx`
- Create: `components/tax/obligations/obligation-status-card.tsx`
- Modify: `app/(app)/tax/page.tsx`
- Modify: `components/tax/layout/tax-workspace-sections.tsx`
- Create: `tests/components/tax/obligations-cockpit.test.mjs`

**Must not touch**
- `components/ui/*`
- `app/(app)/tax/forms/*`

- [ ] Convertir el hub fiscal en cockpit por obligación.
- [ ] Mostrar por obligación:
  - vencimiento
  - readiness
  - bloqueos
  - responsable
  - siguiente acción
- [ ] Hacer que `303` y `115` se vean como obligaciones completas, no como pantallas sueltas.

### Task 4.3: Client-Facing Evidence Requests

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `react-19`, `nextjs-15`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `components/tax/review/review-request-composer.tsx`
- Modify: `app/(app)/unsorted/page.tsx`
- Modify: `app/(app)/capture/inbox/page.tsx`
- Create: `tests/app/tax-review-request-flow.test.mjs`

**Must not touch**
- `components/ui/*`
- `app/(app)/ops/*`

- [ ] Permitir abrir una solicitud al cliente desde revisión fiscal.
- [ ] Reutilizar inbox/capture para resolver documentación pendiente sin rediseño visual.
- [ ] Hacer explícito cuando un documento resuelve una incidencia fiscal abierta.

## Phase 5: Annual Light Layer

### Task 5.1: Manual 111

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `models/tax-forms/model-111-manual.ts`
- Create: `app/(app)/tax/forms/111/page.tsx`
- Create: `components/tax/forms/111/model-111-manual-view.tsx`
- Modify: `app/(app)/tax/forms/page.tsx`
- Create: `tests/models/tax-forms/model-111-manual.test.mjs`

**Must not touch**
- `models/fiscal/transaction-fiscal.ts`
- `docs/superpowers/specs/2026-03-21-model-111-scope.md`

- [ ] Implementar `111` como resumen trimestral manual y etiquetado como manual.
- [ ] Exigir fuente externa/evidencia.
- [ ] Impedir cualquier apariencia de cálculo automático.

### Task 5.2: 180 And 390

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `models/tax-forms/model-180.ts`
- Create: `models/tax-forms/model-390.ts`
- Create: `models/tax-forms/model-180-loader.ts`
- Create: `models/tax-forms/model-390-loader.ts`
- Create: `app/(app)/tax/forms/180/page.tsx`
- Create: `app/(app)/tax/forms/390/page.tsx`
- Create: `components/tax/forms/180/model-180-draft-view.tsx`
- Create: `components/tax/forms/390/model-390-draft-view.tsx`
- Create: `tests/models/tax-forms/model-180.test.mjs`
- Create: `tests/models/tax-forms/model-390.test.mjs`

**Must not touch**
- `111` manual
- `200/202`

- [ ] Derivar `180` desde el núcleo de alquileres con retención.
- [ ] Derivar `390` desde el núcleo IVA ya consolidado.
- [ ] Mantener el mismo patrón de expediente y presentación.

### Task 5.3: 347 And 349

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`, `systematic-debugging`

**Files**
- Create: `models/tax-forms/model-347.ts`
- Create: `models/tax-forms/model-349.ts`
- Create: `app/(app)/tax/forms/347/page.tsx`
- Create: `app/(app)/tax/forms/349/page.tsx`
- Create: `components/tax/forms/347/model-347-draft-view.tsx`
- Create: `components/tax/forms/349/model-349-draft-view.tsx`
- Create: `tests/models/tax-forms/model-347.test.mjs`
- Create: `tests/models/tax-forms/model-349.test.mjs`

**Must not touch**
- `200/202`
- `VERI*FACTU`

- [ ] Implementar `347` y `349` solo si el perfil fiscal y la calidad de terceros lo permiten.
- [ ] Bloquearlos de forma explícita si el tenant no entra en alcance.

### Task 5.4: Annual Handoff Pack

**Subagente**
- tipo: `business-analyst`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `models/fiscal/annual-handoff.ts`
- Create: `app/(app)/tax/archive/annual/page.tsx`
- Create: `components/tax/archive/annual-handoff-card.tsx`
- Create: `tests/models/fiscal/annual-handoff.test.mjs`

**Must not touch**
- `models/tax-forms/model-200*`
- `models/tax-forms/model-202*`

- [ ] Crear capa anual ligera:
  - checklist
  - responsables
  - evidencias
  - documentos esperados
  - estado de handoff
- [ ] Incluir:
  - `200_handoff`
  - `202_handoff`
  - cuentas anuales
  - depósito
  - legalización
- [ ] No prometer cálculo automático.

## Phase 6: Conditional VERI*FACTU Track

### Task 6.1: VERI*FACTU Product Gate

**Subagente**
- tipo: `product-manager`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Modify: `docs/superpowers/specs/2026-03-21-verifactu-track.md`
- Create: `docs/superpowers/specs/2026-03-23-verifactu-product-gate.md`

**Must not touch**
- código del producto

- [ ] Cerrar el gate de producto:
  - si TaxHacker emite facturas como sistema de facturación, entra en prioridad alta
  - si no, queda separado del core fiscal trimestral
- [ ] Dejar explícitas precondiciones y dependencias antes de implementar.

## Phase 7: Final Hardening

### Task 7.1: Fiscal Control Plane Review

**Subagente**
- tipo: `reviewer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `requesting-code-review`, `verification-before-completion`

**Files**
- Review only

**Must not touch**
- no editar; solo findings

- [x] Revisar regresiones de tenancy y billing alrededor del área fiscal.
- [x] Revisar fugas de permisos entre cliente, asesoría y `/ops`.
- [x] Revisar consistencia de estados `draft_ready`, `ready_to_file`, `filed`, `archived`.

### Task 7.2: Fiscal Operations Smoke Suite

**Subagente**
- tipo: `qa-expert`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `playwright`, `verification-before-completion`

**Files**
- Create: `tests/e2e/fiscal-obligations-smoke.spec.ts`
- Create: `tests/e2e/fiscal-collaboration-smoke.spec.ts`

**Must not touch**
- dominio fiscal
- Prisma

- [x] Cubrir smoke real de:
  - cockpit fiscal
  - 303 real
  - 115 real
  - incidencia cliente
  - expediente de presentación
  - archivo trimestral

## Cross-Phase Risks

- Riesgo: intentar cubrir demasiada casuística fiscal española demasiado pronto.
  - Mitigación: ICP estrecho y bloqueo explícito de casos fuera de alcance.
- Riesgo: mezclar UI de obligación con lógica de cálculo.
  - Mitigación: loaders y resolvedores en `models/*`.
- Riesgo: reabrir el debate de nómina/190 sin fuente estructurada.
  - Mitigación: mantener `111` manual y `190` fuera del core.
- Riesgo: querer hacer `200/202` automáticos sin capa contable.
  - Mitigación: handoff anual y checklist, no motor fiscal.
- Riesgo: que la colaboración asesoría-cliente acabe duplicando `/ops`.
  - Mitigación: colaboración dentro del tenant; `/ops` solo plataforma.

## Recommended Execution Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6 solo si el producto de facturación propia lo exige
8. Phase 7

## Acceptance Criteria

- `303` y `115` ya no leen fixtures en runtime.
- Cada obligación visible tiene `estado`, `vencimiento`, `responsable`, `bloqueos` y `siguiente acción`.
- La asesoría puede abrir incidencias al cliente y seguir su resolución.
- El trimestre puede cerrarse con expediente y justificantes, no solo con agregados.
- `111` existe solo como flujo manual y no aparenta cálculo automático.
- `180` y `390` derivan del mismo núcleo ya consolidado.
- `347` y `349` solo aparecen para tenants que realmente entran en alcance.
- `200/202` y mercantil existen como handoff anual, no como automatización engañosa.
- Las pruebas de dominio, UI crítica, TypeScript y build quedan en verde.
