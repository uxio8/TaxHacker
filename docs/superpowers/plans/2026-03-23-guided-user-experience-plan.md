# Guided User Experience Implementation Plan

Status: completed on 2026-03-23 after final review fixes in navigation attention, transaction filter sync and dialog trigger structure.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** llevar TaxHacker al siguiente nivel para usuario final sin tocar la estética, añadiendo una capa transversal de guiado basada en `estado`, `prioridad`, `bloqueo`, `siguiente acción` y `superficie recomendada`.

**Architecture:** no se rediseña el sistema visual. Se mantiene el look actual de cards, badges, botones, sidebar y layouts, y se introduce una lógica unificada de “trabajo pendiente” que alimente onboarding, dashboard, inbox, móvil, libro operativo y fiscal. La secuencia se centra primero en contrato y agregadores de atención, después en superficies de usuario, y solo al final en instrumentación y validación.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, Server Actions, rutas API, estado derivado de dominio, tests Node, Playwright/manual browser validation.

---

## Planning Assumptions

- La estética actual se conserva exactamente:
  - mismos componentes UI
  - mismo lenguaje visual
  - misma densidad general de layout
- El cambio es funcional, no visual:
  - jerarquía
  - defaults
  - estados
  - prioridad
  - CTA principal
  - continuidad entre superficies
- La app debe separarse mentalmente en tres momentos:
  - `puesta en marcha`
  - `operación diaria`
  - `cierre fiscal`
- El motor de guiado debe poder ser consumido desde:
  - dashboard
  - sidebar
  - `unsorted`
  - `capture`
  - `transactions`
  - `tax`

## Out Of Scope

- Rediseño visual
- Cambio de marca, tipografía o paleta
- Reestructuración grande de navegación global
- Nuevos módulos de producto
- Offline, background sync o más PWA
- Roadmap fiscal anual adicional (`390`, `180`, `347`, `200`, `111`, `190`, `VERI*FACTU`)

## Global Delivery Rules

- Orquestación:
  - `writing-plans`
  - `subagent-driven-development`
  - `requesting-code-review`
- Skills obligatorias para implementación:
  - `test-driven-development`
  - `verification-before-completion`
- Skills obligatorias cuando aplique:
  - `brainstorming` para congelar contratos funcionales antes de tocar comportamiento
  - `systematic-debugging` para cualquier descuadre entre estados de dominio y UI
  - `react-19` para componentes y estado cliente
  - `nextjs-15` para Server Actions, loaders y route handlers
- Regla de diseño:
  - no cambiar clases o tokens visuales salvo ajustes mínimos derivados de contenido
  - no introducir una capa de diseño nueva
- Cada tarea cierra con:
  - tests del write set
  - lint del write set
  - `npx tsc --noEmit --pretty false`
  - cuando aplique, validación manual de flujo

## Phase 0: Freeze The Guided UX Contract

### Task 0.1: Work-State Contract

**Subagente**
- tipo: `business-analyst`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-guided-workflow-contract.md`
- Create: `docs/superpowers/specs/2026-03-23-attention-priority-contract.md`

**Must not touch**
- `app/*`
- `components/*`
- `prisma/*`
- `ORCHESTRATOR.md`

- [ ] Definir el ciclo de vida canónico del trabajo del usuario:
  - `captured`
  - `analyzing`
  - `needs_review`
  - `registered`
  - `needs_tax_attention`
  - `ready_to_close`
  - `blocked`
  - `deferred_to_desktop`
- [ ] Definir campos de guiado transversales:
  - `priority`
  - `nextAction`
  - `blockingReason`
  - `recommendedSurface`
  - `humanReason`
- [ ] Cerrar qué estados consumen `dashboard`, `unsorted`, `capture`, `transactions` y `tax`.
- [ ] Congelar la regla explícita de “sin rediseño visual”.

### Task 0.2: Readiness And Mode Contract

**Subagente**
- tipo: `product-manager`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-readiness-and-modes-contract.md`

**Must not touch**
- código del producto

- [ ] Definir los dos modos funcionales:
  - `puesta en marcha`
  - `operación diaria`
- [ ] Definir `readiness` mínimo:
  - empresa
  - proveedor IA
  - perfil fiscal
  - backup básico
- [ ] Cerrar cómo se muestra:
  - banner
  - checklist
  - CTA principal
- [ ] Dejar claro cuándo la app cambia de modo automáticamente.

## Phase 1: Shared Attention Engine

### Task 1.1: Attention Aggregator Backend

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Create: `models/attention.ts`
- Create: `lib/readiness.ts`
- Create: `tests/models/attention.test.mjs`
- Create: `tests/lib/readiness.test.mjs`

**Must not touch**
- `components/ui/*`
- `app/(app)/tax/*`
- `ORCHESTRATOR.md`

- [ ] Construir agregadores de atención y readiness por organización activa.
- [ ] Exponer contratos compactos para:
  - dashboard
  - sidebar
  - `unsorted`
  - móvil
  - fiscal
- [ ] Priorizar incidencias con una regla estable y explícita.
- [ ] Mantener toda la lógica fuera de componentes visuales.
- [ ] Verificar con tests de combinaciones de estados.

### Task 1.2: Attention Copy And Human Labels

**Subagente**
- tipo: `api-documenter`
- modelo: `gpt-5.3-codex-spark`
- razonamiento: `medium`
- skills: `writing-plans`

**Files**
- Modify: `lib/i18n/messages.ts`
- Create: `tests/lib/attention-copy.test.mjs`

**Must not touch**
- lógica de dominio
- estilos

- [ ] Añadir labels humanos para estados, prioridades y CTAs recomendados.
- [ ] Evitar copy técnico en superficies de usuario.
- [ ] Mantener consistencia entre escritorio, móvil y fiscal.

## Phase 2: Onboarding Real And Mode Switching

### Task 2.1: Setup Readiness Surface

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `nextjs-15`, `verification-before-completion`

**Files**
- Create: `components/organization/readiness-checklist.tsx`
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/layout.tsx`
- Create: `tests/app/readiness-surface.test.mjs`

**Must not touch**
- `components/ui/*`
- `prisma/*`
- `ORCHESTRATOR.md`

- [ ] Mostrar checklist de puesta en marcha cuando falte readiness básico.
- [ ] Mostrar CTA principal único hacia la siguiente configuración requerida.
- [ ] Hacer que el checklist desaparezca al quedar listo el tenant.
- [ ] Mantener el mismo look actual de cards, badges y buttons.

### Task 2.2: Dashboard Mode Switch

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `react-19`, `tailwind-4`, `verification-before-completion`

**Files**
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `components/dashboard/welcome-widget.tsx`
- Modify: `components/dashboard/stats-widget.tsx`
- Create: `components/dashboard/attention-center.tsx`
- Create: `tests/components/dashboard/attention-center.test.mjs`

**Must not touch**
- sidebar global
- tax workspace
- estilos base del sistema

- [ ] Separar visualmente `puesta en marcha` de `operación diaria` sin cambiar estética.
- [ ] Añadir una franja principal de “qué requiere atención ahora”.
- [ ] Convertir el dashboard en centro operativo, no solo portada de widgets.

## Phase 3: Canonical Inbox In Unsorted

### Task 3.1: Unsorted Summary Model

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `models/unsorted-inbox.ts`
- Create: `tests/models/unsorted-inbox.test.mjs`
- Modify: `app/(app)/unsorted/page.tsx`

**Must not touch**
- `components/ui/*`
- `app/(app)/transactions/*`
- `ORCHESTRATOR.md`

- [ ] Derivar resumen compacto por documento:
  - estado
  - confianza
  - siguiente acción
  - si requiere escritorio
- [ ] Evitar que el componente de formulario calcule por su cuenta estas reglas.

### Task 3.2: Progressive Disclosure In Analyze Form

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `verification-before-completion`

**Files**
- Modify: `components/unsorted/analyze-form.tsx`
- Modify: `components/files/preview.tsx`
- Create: `tests/components/unsorted/analyze-form-guidance.test.mjs`

**Must not touch**
- `lib/i18n/messages.ts`
- `components/ui/*`
- `ORCHESTRATOR.md`

- [ ] Dejar visible arriba solo:
  - resumen
  - estado
  - CTA principal
  - error/bloqueo
- [ ] Colapsar el detalle del formulario por defecto cuando no sea la acción principal inmediata.
- [ ] Mantener la misma card y la misma jerarquía visual general.

### Task 3.3: Bulk Triage Without Visual Overload

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `react-19`, `verification-before-completion`

**Files**
- Modify: `components/unsorted/analyze-all-button.tsx`
- Modify: `app/(app)/unsorted/page.tsx`
- Create: `tests/app/unsorted-bulk-guidance.test.mjs`

**Must not touch**
- `models/fiscal/*`
- `components/ui/*`

- [ ] Hacer que la acción masiva tenga mejor contexto:
  - cuántos analizables hay
  - qué pasará después
- [ ] Evitar acciones masivas ambiguas cuando falten providers o espacio.

## Phase 4: Transactions As Operational Ledger

### Task 4.1: Exception Views And Quick Filters

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `nextjs-15`, `verification-before-completion`

**Files**
- Modify: `components/transactions/filters.tsx`
- Modify: `app/(app)/transactions/page.tsx`
- Create: `components/transactions/quick-views.tsx`
- Create: `tests/components/transactions/quick-views.test.mjs`

**Must not touch**
- tabla base
- estilos globales
- `ORCHESTRATOR.md`

- [ ] Añadir vistas rápidas operativas:
  - sin categoría
  - incompletas
  - pendientes fiscal
  - este trimestre
- [ ] Mostrar resumen de filtros activos de forma clara.
- [ ] Mantener la tabla como libro principal, no como inbox.

### Task 4.2: Correction Flow Clarity

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `react-19`, `verification-before-completion`

**Files**
- Modify: `components/transactions/list.tsx`
- Modify: `app/(app)/transactions/[transactionId]/page.tsx`
- Create: `tests/components/transactions/list-attention.test.mjs`

**Must not touch**
- `models/transactions.ts`
- `components/ui/*`

- [ ] Hacer más obvio qué registros requieren corrección.
- [ ] Añadir señales ligeras de excepción sin cambiar la estética base.
- [ ] Mejorar el paso `lista -> detalle -> corrección`.

## Phase 5: Tax As Guided Workflow

### Task 5.1: Fiscal Attention Summary

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Create: `models/tax-attention.ts`
- Create: `tests/models/tax-attention.test.mjs`
- Modify: `app/(app)/tax/page.tsx`

**Must not touch**
- `components/ui/*`
- `capture/*`

- [ ] Crear resumen fiscal guiado:
  - documentos bloqueados
  - trimestre activo
  - siguiente acción fiscal
- [ ] No duplicar lógica de revisión si ya existe en dominio fiscal.

### Task 5.2: Tax Workspace Guidance Layer

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `react-19`, `verification-before-completion`

**Files**
- Modify: `components/tax/layout/tax-workspace-header.tsx`
- Modify: `components/tax/layout/tax-workspace-sections.tsx`
- Create: `components/tax/layout/tax-next-action-card.tsx`
- Create: `tests/components/tax/tax-next-action-card.test.mjs`

**Must not touch**
- formularios 303/115
- estilos base
- `ORCHESTRATOR.md`

- [ ] Hacer que `Tax` se sienta flujo guiado y no portal de módulos.
- [ ] Mantener módulos como navegación secundaria.
- [ ] Exponer CTA principal según estado fiscal real.

## Phase 6: Mobile And Desktop Continuity

### Task 6.1: Escalation Clarity

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `test-driven-development`, `react-19`, `verification-before-completion`

**Files**
- Modify: `components/capture/mobile-inbox.tsx`
- Modify: `components/capture/mobile-review.tsx`
- Modify: `components/capture/mobile-contract.ts`
- Create: `tests/components/capture/mobile-escalation-copy.test.mjs`

**Must not touch**
- uploader
- layout móvil base
- `ORCHESTRATOR.md`

- [ ] Explicar mejor por qué un documento se deriva a escritorio.
- [ ] Hacer visible el siguiente paso recomendado.
- [ ] Evitar estados móviles técnicamente correctos pero poco humanos.

### Task 6.2: Desktop Continuation Handoff

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `app/(app)/unsorted/page.tsx`
- Modify: `components/dashboard/unsorted-widget.tsx`
- Modify: `app/(app)/dashboard/page.tsx`
- Create: `tests/app/mobile-desktop-handoff.test.mjs`

**Must not touch**
- `app/(app)/capture/*`
- `components/ui/*`

- [ ] Hacer visible en escritorio lo que viene derivado desde móvil.
- [ ] Unificar la semántica de `deferred_to_desktop` con el inbox canónico.

## Phase 7: Navigation And Sidebar Guidance

### Task 7.1: Sidebar As Attention Surface

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `react-19`, `verification-before-completion`

**Files**
- Modify: `components/sidebar/sidebar.tsx`
- Modify: `components/sidebar/mobile-menu.tsx`
- Create: `tests/components/sidebar/attention-nav.test.mjs`

**Must not touch**
- iconografía base
- branding
- `ORCHESTRATOR.md`

- [ ] Introducir señales ligeras de atención y readiness en navegación.
- [ ] No añadir más módulos; solo priorizar mejor los existentes.
- [ ] Mantener exactamente el estilo actual del sidebar.

## Phase 8: Validation, Metrics And Launch Criteria

### Task 8.1: Lightweight Product Metrics

**Subagente**
- tipo: `data-analyst`
- modelo: `gpt-5.3-codex-spark`
- razonamiento: `medium`
- skills: `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-guided-ux-metrics.md`
- Modify: `ORCHESTRATOR.md`

**Must not touch**
- runtime product code

- [ ] Fijar métricas mínimas para validar el cambio:
  - captura -> registrado
  - backlog de revisión
  - bloqueos fiscales
  - tasa de derivación a escritorio
- [ ] Definir dónde leer esas señales con el stack actual.

### Task 8.2: Manual End-To-End Validation

**Subagente**
- tipo: `browser-debugger`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `playwright-interactive`, `verification-before-completion`

**Files**
- Create: `docs/superpowers/specs/2026-03-23-guided-ux-validation.md`

**Must not touch**
- código del producto

- [ ] Validar flujos reales:
  - setup mínimo
  - dashboard con atención
  - `unsorted` de punta a punta
  - móvil -> escritorio
  - revisión fiscal guiada
- [ ] Registrar fricción observada antes de llamar a la fase cerrada.

## Recommended Execution Order

1. `0.1`
2. `0.2`
3. `1.1`
4. `1.2`
5. `2.1`
6. `2.2`
7. `3.1`
8. `3.2`
9. `3.3`
10. `4.1`
11. `4.2`
12. `5.1`
13. `5.2`
14. `6.1`
15. `6.2`
16. `7.1`
17. `8.1`
18. `8.2`

## Review Policy

- Tras cada bloque funcional:
  - subagente `reviewer`
  - modelo `gpt-5.4`
  - razonamiento `high`
  - skill `requesting-code-review`
- Para bloques con impacto transversal (`1.x`, `3.x`, `5.x`):
  - segunda revisión con `code-reviewer`
  - modelo `gpt-5.4`
  - razonamiento `high`

## Exit Criteria

La fase se considera cerrada solo si:

- la app mantiene exactamente el mismo sistema visual
- existe una capa de atención coherente entre dashboard, inbox, móvil y fiscal
- el usuario ve una acción principal clara en cada superficie
- `unsorted` actúa como inbox operativo canónico
- `tax` deja de sentirse como portal y pasa a ser flujo guiado
- los tests del write set están en verde
- `npx tsc --noEmit --pretty false` está en verde
- `npm run build` está en verde
