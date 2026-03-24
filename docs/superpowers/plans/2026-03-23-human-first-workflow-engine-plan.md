# Human-First Workflow Engine Implementation Plan

Status: executed on 2026-03-24.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** unificar TaxHacker alrededor de un workflow semántico común para empresa individual, manteniendo la verdad en el dominio actual y migrando el producto por vertical slices reversibles, sin tocar la estética y dejando el sistema preparado para endurecimiento durable, cartera futura de asesoría y agentes posteriores.

**Architecture:** primero se congela un contrato semántico y una `read API` estable para que dashboard, unsorted, capture, tax, archive y transactions dejen de recomponer estado por su cuenta. Después se construyen projectors puros sobre las tablas actuales y se migran slices bajo feature flag y con paridad medida. La persistencia adicional (`WorkItem` materializado, `DomainEvent`, `WorkflowJob`) entra solo cuando un umbral operativo la justifique; no antes.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, Server Actions, worker actual `web + worker`, Node tests, Playwright, TypeScript estricto en dominio y proyecciones.

## Execution Outcome

- Ejecutadas:
  - `Phase 0`
  - `Phase 1`
  - `Phase 2`
  - `Phase 3`
  - `Phase 4`
  - `Phase 6`
- No ejecutada `Phase 5`:
  - `Gate C` no disparado para materializar `WorkItem`
  - `Gate D` no disparado para persistir `DomainEvent`
  - `Gate E` no disparado para introducir `WorkflowJob`
- Resultado final:
  - contrato semántico congelado
  - `read APIs` estables por slice
  - slices `documental`, `fiscal` y `transactions` bajo flag con fallback legacy
  - capa `portfolio-ready` sin abrir todavía UX multiempresa
  - cleanup legacy final acotado a puntos con paridad probada
    - `models/attention.ts` ahora es fachada fina sobre `models/attention-runtime.ts`
    - `lib/mobile-triage.ts` se separa en parte pura (`lib/mobile-triage-shared.ts`) y parte server/runtime para evitar imports `node:` en cliente
  - no se ha endurecido persistencia adicional antes de tiempo

---

## Final Thesis

- `semantic workflow now`
- `stable read API now`
- `projectors now`
- `vertical slices now`
- `durable infrastructure only when metrics and operation require it`

## Planning Assumptions

- El foco inicial es `empresa individual`, no `asesoría multiempresa`.
- La app debe quedar `portfolio-ready`, pero la UX de cartera queda fuera de esta primera ola.
- No se toca la estética:
  - mismo layout
  - mismas cards
  - mismo lenguaje visual
  - mismos componentes base
- La fuente de verdad sigue en el dominio actual:
  - `File`
  - `AnalysisJob`
  - `Transaction`
  - `FiscalObligation`
  - `FiscalFilingDossier`
  - `LegalArchive`
- `WorkItem` nace primero como interfaz semántica y proyección lógica; no como tabla obligatoria.
- `DomainEvent` no se introduce hasta que haga falta causalidad o auditoría cross-process real.
- `WorkflowJob` no se introduce hasta que exista un segundo caso async claro más allá de `AnalysisJob`.
- La unidad de control es `organizationId + periodKey`.
- La definición de `done` sigue siendo `expediente defendible`.

## Out Of Scope

- Capa real de agentes autónomos
- Sustitución completa de `AnalysisJob`
- Workflow engine genérico tipo BPM
- Event bus externo o microservicios
- Nueva navegación de asesoría o cartera multiempresa
- Rediseño visual
- Refactor masivo del dominio actual en una sola ola

## Gates

### Gate A: Stable Read API

No se migra ninguna pantalla hasta que exista una capa estable de consultas/proyecciones para:
- `WorkItem`
- `PeriodClosurePosture`
- `TopExceptions`
- `NextAction`

### Gate B: Slice Parity

No se limpia ninguna lógica legacy hasta que el slice tenga:
- feature flag
- comparación legacy vs nueva
- drift aceptable
- rollback simple

### Gate C: Materialized WorkItem

Solo se materializa `WorkItem` si ocurre al menos una de estas condiciones:
- el rebuild por `organizationId + periodKey` ya es demasiado caro
- varias superficies necesitan la misma lectura consistente y estable
- el tiempo de respuesta de las proyecciones degrada la UX

### Gate D: DomainEvent

Solo se introduce `DomainEvent` persistido si hace falta al menos una de estas cosas:
- causalidad o correlación cross-process real
- auditoría de decisiones operativas más allá del dominio actual
- disparo fiable entre procesos

### Gate E: WorkflowJob

Solo se introduce `WorkflowJob` si ocurre al menos una de estas condiciones:
- aparece un segundo caso async claro además de `AnalysisJob`
- el rebuild/recalc ya no debe ejecutarse inline
- hace falta lease/heartbeat/recovery para trabajo nuevo que no cabe en el worker actual

## Global Delivery Rules

- Orquestación:
  - `writing-plans`
  - `subagent-driven-development`
  - `requesting-code-review`
- Skills obligatorias para implementación:
  - `test-driven-development`
  - `verification-before-completion`
  - `typescript`
- Skills obligatorias cuando aplique:
  - `systematic-debugging` para drift entre proyección y dominio
  - `nextjs-15` para Server Actions, loaders y route handlers
  - `react-19` para superficies cliente
  - `playwright` para smokes de flujo
- Guardrails:
  - no mezclar cambio de schema nuevo con primera migración de una UI consumidora
  - no sustituir `AnalysisJob`, `FiscalObligation` ni `FiscalFilingDossier` en esta primera ola
  - no tocar `tax` y `transactions` en la misma task
  - no mezclar backfill histórico con cleanup legacy
  - no abrir aún UX multiempresa; solo preparar queries y scope
- Cada task cierra con:
  - tests del write set
  - `npx eslint` del write set
  - `npx tsc --noEmit --pretty false`
  - cuando toque schema:
    - `npx prisma validate`
    - `npx prisma generate`
  - cuando toque superficies:
    - smoke manual o Playwright

## File Structure

### Create First

- `docs/superpowers/specs/2026-03-23-human-first-workflow-engine-contract.md`
- `docs/superpowers/specs/2026-03-23-period-closure-posture-contract.md`
- `docs/superpowers/specs/2026-03-23-workflow-read-api-contract.md`
- `models/workflow/contracts.ts`
- `models/workflow/read-api.ts`
- `models/workflow/period-closure.ts`
- `models/workflow/rebuild.ts`
- `models/workflow/projectors/readiness.ts`
- `models/workflow/projectors/documents.ts`
- `models/workflow/projectors/fiscal.ts`
- `models/workflow/projectors/transactions.ts`
- `models/workflow/flags.ts`
- `models/workflow/metrics.ts`
- `tests/models/workflow/read-api.test.mjs`
- `tests/models/workflow/period-closure.test.mjs`
- `tests/models/workflow/rebuild.test.mjs`
- `tests/models/workflow/projectors-readiness.test.mjs`
- `tests/models/workflow/projectors-documents.test.mjs`
- `tests/models/workflow/projectors-fiscal.test.mjs`
- `tests/models/workflow/projectors-transactions.test.mjs`
- `tests/models/workflow/parity.test.mjs`

### Create Only After Gates

- `models/workflow/work-items.ts`
- `models/workflow/domain-events.ts`
- `models/workflow/workflow-jobs.ts`
- `models/workflow/portfolio-projections.ts`
- `tests/models/workflow/work-items.test.mjs`
- `tests/models/workflow/domain-events.test.mjs`
- `tests/models/workflow/workflow-jobs.test.mjs`
- `tests/models/workflow/portfolio-projections.test.mjs`

### Modify

- `models/attention.ts`
- `models/unsorted-inbox.ts`
- `models/mobile/inbox.ts`
- `models/mobile/capture.ts`
- `models/analysis-jobs.ts`
- `models/uploads.ts`
- `models/transactions.ts`
- `models/tax-attention.ts`
- `models/fiscal/obligations.ts`
- `models/fiscal/filing-dossiers.ts`
- `models/fiscal/legal-archive.ts`
- `app/(app)/dashboard/page.tsx`
- `components/dashboard/attention-center.tsx`
- `components/dashboard/unsorted-widget.tsx`
- `app/(app)/settings/page.tsx`
- `components/organization/readiness-checklist.tsx`
- `app/(app)/unsorted/page.tsx`
- `components/unsorted/analyze-form.tsx`
- `app/(app)/capture/page.tsx`
- `app/(app)/capture/inbox/page.tsx`
- `components/capture/mobile-inbox.tsx`
- `components/capture/mobile-contract.ts`
- `app/(app)/tax/page.tsx`
- `components/tax/obligations/obligations-cockpit.tsx`
- `components/tax/layout/tax-workspace-header.tsx`
- `components/tax/layout/tax-workspace-sections.tsx`
- `app/(app)/tax/archive/page.tsx`
- `app/(app)/tax/archive/annual/page.tsx`
- `components/tax/archive/archive-manifest-view.tsx`
- `components/tax/archive/annual-handoff-card.tsx`
- `app/(app)/transactions/page.tsx`
- `app/(app)/transactions/[transactionId]/page.tsx`
- `components/transactions/quick-views.tsx`
- `components/transactions/list.tsx`
- `components/transactions/fiscal-panel.tsx`
- `app/(app)/settings/actions.ts`
- `app/(app)/settings/organization-actions.ts`
- `app/(app)/unsorted/actions.ts`
- `app/(app)/capture/review/[fileId]/actions.ts`
- `app/(app)/capture/review/[fileId]/review-actions-core.ts`
- `app/(app)/tax/forms/[obligationCode]/evidence/actions.ts`
- `app/(app)/tax/archive/annual/actions.ts`
- `prisma/schema.prisma`
- `lib/analysis-worker.ts`
- `lib/analysis-worker-supervisor.ts`

## Parallelism Strategy

- `semantic-contract` bloquea al resto
- `read-api + projectors` bloquean la primera migración de UI
- Después, los slices pueden ejecutarse en paralelo si no comparten write set:
  - `documental`
  - `fiscal`
  - `libro`
- No se paralelizan:
  - `tax` con `transactions`
  - `archive` con `transactions`
  - `materialización durable` con `cleanup legacy`

## Phase 0: Freeze Semantics And Read API

### Task 0.1: Workflow Semantic Contract

**Subagente**
- tipo: `api-designer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-human-first-workflow-engine-contract.md`

**Must not touch**
- `app/*`
- `components/*`
- `prisma/*`
- `ORCHESTRATOR.md`

- [ ] Congelar la cadena canónica:
  - `document_evidence`
  - `operational_record`
  - `fiscal_obligation`
  - `filing_dossier`
  - `archive_manifest`
- [ ] Congelar los campos transversales:
  - `status`
  - `owner`
  - `dueAt`
  - `materiality`
  - `confidence`
  - `blockingReason`
  - `nextAction`
  - `recommendedSurface`
- [ ] Definir `WorkItem` como interfaz semántica, no como tabla obligatoria.

### Task 0.2: Period Closure Posture Contract

**Subagente**
- tipo: `business-analyst`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-period-closure-posture-contract.md`

**Must not touch**
- código del producto

- [ ] Congelar la postura de cierre:
  - `blocked`
  - `at_risk`
  - `on_track`
  - `defendible`
  - `filed`
  - `archived`
- [ ] Definir criterios desde:
  - readiness
  - evidencia
  - obligaciones
  - dossier
  - justificante
  - archivo

### Task 0.3: Stable Read API Contract

**Subagente**
- tipo: `api-designer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-workflow-read-api-contract.md`

**Must not touch**
- `prisma/*`
- `components/*`

- [ ] Definir la capa estable que consumirá la UI:
  - `getPeriodClosurePosture()`
  - `listTopWorkflowItems()`
  - `getWorkflowReadinessSummary()`
  - `getWorkflowDocumentInbox()`
  - `getWorkflowFiscalCockpit()`
  - `getWorkflowTransactionExceptions()`
- [ ] Dejar claro que la UI no lee projectors internos directamente.

## Phase 1: Build Pure Projectors And Stable Read API

### Task 1.1: Workflow Read API And Projector Contracts

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `typescript`, `verification-before-completion`

**Files**
- Create: `models/workflow/contracts.ts`
- Create: `models/workflow/read-api.ts`
- Create: `models/workflow/period-closure.ts`
- Test: `tests/models/workflow/read-api.test.mjs`
- Test: `tests/models/workflow/period-closure.test.mjs`

**Must not touch**
- `prisma/*`
- `app/*`
- `components/*`

- [ ] Implementar tipos compartidos y contratos de lectura estables.
- [ ] Implementar `getPeriodClosurePosture()` sobre el dominio actual.
- [ ] Implementar `listTopWorkflowItems()` como interfaz lógica aunque aún no exista tabla `WorkItem`.
- [ ] Mantener la implementación interna intercambiable.

### Task 1.2: Pure Projectors And Deterministic Rebuild

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Create: `models/workflow/rebuild.ts`
- Create: `models/workflow/projectors/readiness.ts`
- Create: `models/workflow/projectors/documents.ts`
- Create: `models/workflow/projectors/fiscal.ts`
- Create: `models/workflow/projectors/transactions.ts`
- Test: `tests/models/workflow/rebuild.test.mjs`
- Test: `tests/models/workflow/projectors-readiness.test.mjs`
- Test: `tests/models/workflow/projectors-documents.test.mjs`
- Test: `tests/models/workflow/projectors-fiscal.test.mjs`
- Test: `tests/models/workflow/projectors-transactions.test.mjs`

**Must not touch**
- `prisma/*`
- `app/*`
- `components/*`

- [ ] Construir projectors puros leyendo las tablas actuales.
- [ ] Implementar rebuild por `organizationId` y por `organizationId + periodKey`.
- [ ] Asegurar idempotencia y ausencia de dependencias circulares.

### Task 1.3: Flags, Metrics And Parity Harness

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`, `typescript`

**Files**
- Create: `models/workflow/flags.ts`
- Create: `models/workflow/metrics.ts`
- Test: `tests/models/workflow/parity.test.mjs`

**Must not touch**
- `app/(app)/tax/*`
- `app/(app)/transactions/*`

- [ ] Definir feature flags por superficie:
  - `workflow_dashboard_v1`
  - `workflow_unsorted_v1`
  - `workflow_capture_v1`
  - `workflow_tax_v1`
  - `workflow_archive_v1`
  - `workflow_transactions_v1`
- [ ] Añadir métricas de:
  - drift legacy vs nuevo
  - coste de rebuild
  - work items lógicos huérfanos
  - postura de cierre inválida
- [ ] Construir un harness de paridad antes de migrar UI.

## Phase 2: Vertical Slice A - Documental

### Task 2.1: Readiness And Document Read API

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `models/attention.ts`
- Modify: `models/unsorted-inbox.ts`
- Modify: `models/mobile/inbox.ts`
- Modify: `models/mobile/capture.ts`
- Modify: `models/analysis-jobs.ts`
- Modify: `models/uploads.ts`
- Test: `tests/models/attention.test.mjs`
- Test: `tests/models/unsorted-inbox.test.mjs`
- Test: `tests/models/mobile/inbox.test.mjs`
- Test: `tests/models/mobile/capture.test.mjs`
- Test: `tests/models/uploads.test.mjs`

**Must not touch**
- `app/(app)/tax/*`
- `app/(app)/transactions/*`
- `components/*`

- [ ] Adaptar contratos legacy para que lean la nueva read API estable.
- [ ] Mantener intacta la verdad del dominio documental y de `AnalysisJob`.
- [ ] No introducir schema nuevo todavía.

### Task 2.2: Dashboard, Unsorted And Capture Under Flag

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `nextjs-15`, `verification-before-completion`

**Files**
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `components/dashboard/attention-center.tsx`
- Modify: `components/dashboard/unsorted-widget.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `components/organization/readiness-checklist.tsx`
- Modify: `app/(app)/unsorted/page.tsx`
- Modify: `components/unsorted/analyze-form.tsx`
- Modify: `app/(app)/capture/page.tsx`
- Modify: `app/(app)/capture/inbox/page.tsx`
- Modify: `components/capture/mobile-inbox.tsx`
- Modify: `components/capture/mobile-contract.ts`
- Test: `tests/components/dashboard/attention-center.test.mjs`
- Test: `tests/components/unsorted/analyze-form-guidance.test.mjs`
- Test: `tests/components/capture/mobile-contract.test.mjs`
- Test: `tests/components/capture/mobile-surface-source.test.mjs`
- Test: `tests/app/readiness-surface.test.mjs`
- Test: `tests/app/mobile-desktop-handoff.test.mjs`

**Must not touch**
- `prisma/*`
- `models/fiscal/*`
- `components/tax/*`

- [ ] Migrar el slice documental completo bajo flag.
- [ ] Mantener la misma estética.
- [ ] Validar paridad legacy vs nuevo antes de dejar el flag por defecto.

## Phase 3: Vertical Slice B - Fiscal

### Task 3.1: Fiscal Read API

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `typescript`, `verification-before-completion`

**Files**
- Modify: `models/tax-attention.ts`
- Modify: `models/fiscal/obligations.ts`
- Modify: `models/fiscal/filing-dossiers.ts`
- Modify: `models/fiscal/legal-archive.ts`
- Test: `tests/models/fiscal/obligations.test.mjs`
- Test: `tests/models/fiscal/filing-dossiers.test.mjs`
- Test: `tests/models/fiscal/legal-archive.test.mjs`
- Test: `tests/models/fiscal/legal-archive-filings.test.mjs`

**Must not touch**
- `prisma/*`
- `app/(app)/transactions/*`
- `components/transactions/*`

- [ ] Adaptar fiscal a la read API estable sin cambiar la verdad de `FiscalObligation` y `FiscalFilingDossier`.
- [ ] Hacer explícita la postura de cierre del periodo desde fiscal.

### Task 3.2: Tax And Archive Under Flag

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `nextjs-15`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `app/(app)/tax/page.tsx`
- Modify: `components/tax/obligations/obligations-cockpit.tsx`
- Modify: `components/tax/layout/tax-workspace-header.tsx`
- Modify: `components/tax/layout/tax-workspace-sections.tsx`
- Modify: `app/(app)/tax/archive/page.tsx`
- Modify: `app/(app)/tax/archive/annual/page.tsx`
- Modify: `components/tax/archive/archive-manifest-view.tsx`
- Modify: `components/tax/archive/annual-handoff-card.tsx`
- Test: `tests/components/tax/obligations-cockpit.test.mjs`
- Test: `tests/app/tax/tenant-guards.test.mjs`
- Test: `tests/e2e/fiscal-obligations-smoke.spec.ts`

**Must not touch**
- `prisma/*`
- `components/dashboard/*`
- `components/transactions/*`

- [ ] Migrar `tax` y `archive` bajo flag.
- [ ] Mantener `archive` como prueba de cierre, no como simple histórico.
- [ ] No limpiar aún la lógica legacy si no hay paridad.

## Phase 4: Vertical Slice C - Libro

### Task 4.1: Transaction Exception Read API

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `models/transactions.ts`
- Test: `tests/components/transactions/list-attention.test.mjs`
- Test: `tests/components/transactions/quick-views.test.mjs`

**Must not touch**
- `app/(app)/tax/*`
- `components/tax/*`

- [ ] Exponer excepciones del libro vía read API estable.
- [ ] Mantener `Transaction` como fuente principal del libro.

### Task 4.2: Transactions Under Flag

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `nextjs-15`, `verification-before-completion`

**Files**
- Modify: `app/(app)/transactions/page.tsx`
- Modify: `app/(app)/transactions/[transactionId]/page.tsx`
- Modify: `components/transactions/quick-views.tsx`
- Modify: `components/transactions/list.tsx`
- Modify: `components/transactions/fiscal-panel.tsx`
- Test: `tests/app/transactions/guided-ux-contract.test.mjs`
- Test: `tests/app/transactions/fiscal-page.test.mjs`
- Test: `tests/app/transactions/fiscal-actions.test.mjs`

**Must not touch**
- `prisma/*`
- `app/(app)/tax/*`
- `components/tax/*`

- [ ] Migrar `transactions` bajo flag.
- [ ] Mostrar excepciones materiales y siguiente acción sin cambiar el look.

## Phase 5: Durable Hardening Only If Gates Are Crossed

### Task 5.1: Materialize WorkItem If Gate C Fires

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `typescript`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_work_items/migration.sql`
- Create: `models/workflow/work-items.ts`
- Test: `tests/models/workflow/work-items.test.mjs`

**Must not touch**
- `app/*`
- `components/*`
- `lib/analysis-worker.ts`

- [ ] Materializar `WorkItem` solo si el coste de rebuild o la necesidad de lecturas consistentes lo exigen.
- [ ] Mantener la misma read API pública para que la UI no cambie.

### Task 5.2: Persist DomainEvent If Gate D Fires

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`, `typescript`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_domain_events/migration.sql`
- Create: `models/workflow/domain-events.ts`
- Test: `tests/models/workflow/domain-events.test.mjs`

**Must not touch**
- `app/*`
- `components/*`
- `models/fiscal/*`

- [ ] Persistir `DomainEvent` solo si ya hace falta causalidad, auditoría o disparo cross-process real.
- [ ] No convertirlo en fuente de verdad.

### Task 5.3: Introduce WorkflowJob Only If Gate E Fires

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_workflow_jobs/migration.sql`
- Create: `models/workflow/workflow-jobs.ts`
- Modify: `lib/analysis-worker.ts`
- Modify: `lib/analysis-worker-supervisor.ts`
- Test: `tests/models/workflow/workflow-jobs.test.mjs`
- Test: `tests/lib/worker-runtime.test.mjs`
- Test: `tests/app/analysis-worker-autostart.test.mjs`

**Must not touch**
- `app/(app)/dashboard/*`
- `app/(app)/tax/*`
- `components/*`

- [ ] Introducir `WorkflowJob` solo cuando `AnalysisJob` y jobs deterministas ya no basten.
- [ ] Mantener la convivencia con el worker actual.

## Phase 6: Portfolio-Ready Layer And Cleanup

### Task 6.1: Portfolio-Ready Query Surface

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `typescript`, `verification-before-completion`

**Files**
- Create: `models/workflow/portfolio-projections.ts`
- Test: `tests/models/workflow/portfolio-projections.test.mjs`

**Must not touch**
- `app/(app)/ops/*`
- nuevas páginas de asesoría

- [ ] Exponer consultas de cartera futura sin abrir aún UX multiempresa.
- [ ] Preparar `organizationId`, postura de cierre, top exception y siguiente vencimiento.

### Task 6.2: Cleanup Legacy After Proven Parity

**Subagente**
- tipo: `refactoring-specialist`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `models/attention.ts`
- Modify: `models/unsorted-inbox.ts`
- Modify: `models/mobile/inbox.ts`
- Modify: `models/tax-attention.ts`
- Test: `tests/models/attention.test.mjs`
- Test: `tests/models/unsorted-inbox.test.mjs`
- Test: `tests/models/mobile/inbox.test.mjs`
- Test: `tests/models/fiscal/obligations.test.mjs`

**Must not touch**
- `prisma/*`
- `app/(app)/ops/*`
- `components/ui/*`

- [ ] Retirar duplicación solo cuando el slice correspondiente haya superado Gate B.
- [ ] Mantener contratos públicos estables o migrarlos con tests de paridad.

**Estado ejecutado**
- cleanup real aplicado en el frente con duplicación y riesgo ya validados:
  - `models/attention.ts`
  - `models/attention-runtime.ts`
  - `lib/mobile-triage.ts`
  - `lib/mobile-triage-shared.ts`
- se mantiene intacto el resto del dominio legacy que todavía no necesitaba limpieza para cerrar el plan:
  - `models/mobile/inbox.ts`
  - `models/tax-attention.ts`

### Task 6.3: Final Review

**Subagente**
- tipo: `reviewer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `requesting-code-review`, `verification-before-completion`

**Files**
- Review only: write set completo del cambio

**Must not touch**
- sin write set propio

- [ ] Revisar:
  - drift entre legacy y nuevo
  - pérdida de tenancy
  - postura de cierre incoherente
  - acoplamiento de UI a internals de projector
  - endurecimiento durable introducido antes de sus gates

**Estado ejecutado**
- review final pasada con corrección aplicada al entrypoint público `models/attention.ts`
- verificación final cerrada con:
  - suite workflow/attention/documental
  - `eslint`
  - `build`
  - `tsc`
  - smokes E2E fiscales

## Recommended Execution Order

1. `Phase 0`
2. `Phase 1`
3. `Phase 2`
4. `Phase 3`
5. `Phase 4`
6. Evaluar `Gate C`, `Gate D` y `Gate E`
7. Ejecutar `Phase 5` solo si aplica
8. `Phase 6`

## Execution Notes

- La secuencia segura es:
  - `semantic contract`
  - `stable read API`
  - `pure projectors`
  - `vertical slices under flag`
  - `durable hardening only if gates fire`
  - `legacy cleanup at the end`
- Si una task obliga a tocar schema y primera UI consumidora a la vez, partirla.
- Si una task intenta sustituir `AnalysisJob`, `FiscalObligation` o `FiscalFilingDossier`, es demasiado grande.
- El modo recomendado de ejecución para este plan es `subagent-driven`.
