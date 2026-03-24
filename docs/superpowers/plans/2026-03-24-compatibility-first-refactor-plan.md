# Compatibility-First Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** limpiar y escalar TaxHacker sin cambiar comportamiento visible, reduciendo el radio de cambio mediante compatibilidad, fachadas estables, read APIs y refactor por change paths.

**Architecture:** no se hace una reescritura ni una limpieza horizontal por carpetas. Primero se congela compatibilidad por superficie, luego se fijan fronteras y fachadas públicas, y después se extraen hotspots internos por vertical slices con paridad, flags y rollback simple. El endurecimiento del build llega solo al final, cuando el repo ya no depende de tolerancias para seguir moviéndose.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, Server Actions, `node:test`, Playwright, TypeScript estricto en dominio, read APIs en `models/workflow/*`.

---

## Thesis

- `compatibility-first`
- `facade-first`
- `change-path-first`
- `stable read API now`
- `cleanup only with proven parity`
- `build hardening last`

## Scope

Este plan cubre:
- `dashboard`
- `unsorted`
- `capture`
- `tax`
- `archive`
- `transactions`
- `organizations`
- `ops`
- harness de compatibilidad
- guardrails de arquitectura
- endurecimiento final de build y tipado

Este plan no cubre:
- cambios funcionales de producto
- multiempresa/portfolio UX nueva
- agentes autónomos
- infraestructura durable nueva (`DomainEvent`, `WorkflowJob`)
- rediseño visual
- reordenación física masiva del repo

## Current Risks To Remove

1. Pages que recomponen semántica de dominio ya presente en read APIs.
2. Hotspots con demasiadas responsabilidades mezcladas.
3. Falta de `compatibility harness` real por superficie.
4. Falta de reglas verificables de frontera entre `app`, `components`, `models`, `lib`.
5. Dependencia de tolerancias de build:
   - `ignoreDuringBuilds` en [next.config.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/next.config.ts)
   - `allowJs` y `skipLibCheck` en [tsconfig.json](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tsconfig.json)

## Hotspots Prioritarios

- [app/(app)/tax/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/tax/page.tsx)
- [app/(app)/transactions/[transactionId]/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/transactions/%5BtransactionId%5D/page.tsx)
- [components/unsorted/analyze-form.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/components/unsorted/analyze-form.tsx)
- [models/organizations.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/organizations.ts)
- [models/fiscal/legal-archive.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/fiscal/legal-archive.ts)
- [models/workflow/fiscal-read-api.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/fiscal-read-api.ts)
- [models/workflow/transaction-read-api.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/transaction-read-api.ts)
- [models/workflow/document-read-api.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/document-read-api.ts)

## Architectural Target

- `app/`: routing, auth, tenant, loaders, composición
- `components/`: render, formularios, interacción local
- `models/`: dominio, queries, commands, read models, fachadas públicas
- `lib/`: infraestructura técnica y helpers puros

## Global Gates

### Gate A: Compatibility Harness

No se limpia ningún hotspot hasta que exista:
- `verify:critical`
- suite de paridad por superficie
- smoke Playwright crítico por superficie

### Gate B: Stable Public Facades

No se cambian imports públicos al principio.
Primero se extrae por dentro y solo al final se valora cambiar API pública.

### Gate C: Slice Parity

No se elimina lógica legacy de un slice hasta que:
- `postureChanged = false`
- `topItemChanged = false`
- `orphanWorkflowItems = []`
- `invalidWorkflowPosture = null`
- smoke del slice en verde

### Gate D: Build Hardening

No se toca:
- `ignoreDuringBuilds`
- `allowJs`
- `skipLibCheck`

hasta que los slices funcionales estén cerrados.

## Global Delivery Rules

- Orquestación:
  - [$subagent-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/subagent-driven-development/SKILL.md)
  - [$requesting-code-review](/Users/uxiomarcosmacmini/.codex/superpowers/skills/requesting-code-review/SKILL.md)
- Skills obligatorias en implementación:
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)
- Skills por tipo de tarea:
  - wiring App Router y Server Actions:
    - [$nextjs-15](/Users/uxiomarcosmacmini/.agents/skills/nextjs-15/SKILL.md)
  - componentes React:
    - [$react-19](/Users/uxiomarcosmacmini/.agents/skills/react-19/SKILL.md)
  - E2E/smokes:
    - [$playwright](/Users/uxiomarcosmacmini/.agents/skills/playwright/SKILL.md)
  - bugs o drift:
    - [$systematic-debugging](/Users/uxiomarcosmacmini/.codex/superpowers/skills/systematic-debugging/SKILL.md)

## Subagent Pool

| Rol | Uso principal | Modelo | Razonamiento |
|---|---|---|---|
| `qa-expert` | compatibilidad, paridad, gates, rollback | `gpt-5.4` | `high` |
| `architect-reviewer` | fronteras, deuda aceptable, cierre final | `gpt-5.4` | `high` |
| `typescript-pro` | extraer fachadas y módulos internos | `gpt-5.4` | `high` |
| `nextjs-developer` | páginas App Router, actions, wiring | `gpt-5.4` | `high` |
| `react-specialist` | troceo de componentes sin cambio funcional | `gpt-5.4` | `medium` |
| `reviewer` | revisión final por task o PR interna | `gpt-5.4` | `high` |

## Parallelization Rules

Después de `0.3` pueden ir en paralelo:
- rama documental
- rama fiscal
- rama organizaciones

No ejecutar a la vez:
- `tax` profundo y `transactions` profundo sobre el mismo dominio fiscal
- `organizations` y cambios amplios en `ops` sobre miembros/invitaciones
- hardening de build mientras haya slices funcionales abiertos

## Phase 0: Safety Net

### Task 0.1: Blindaje de compatibilidad crítica

**Subagente**
- tipo: `qa-expert`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)
  - [$playwright](/Users/uxiomarcosmacmini/.agents/skills/playwright/SKILL.md)

**Files**
- Modify: [package.json](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/package.json)
- Create: [tests/critical](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tests/critical)
- Create: [docs/superpowers/specs/2026-03-24-compatibility-harness-contract.md](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/docs/superpowers/specs/2026-03-24-compatibility-harness-contract.md)

**Must not touch**
- `models/fiscal/*`
- `components/*`
- `app/*`

- [ ] Definir `verify:critical` con:
  - `npx tsc --noEmit --pretty false`
  - suites `node:test` críticas
  - smokes Playwright críticos
- [ ] Crear contrato de compatibilidad por superficie:
  - `dashboard`
  - `unsorted`
  - `capture`
  - `tax`
  - `archive`
  - `transactions`
  - `ops`
- [ ] Fijar thresholds de drift aceptable.
- [ ] Documentar rollback simple por flag.

### Task 0.2: Reglas de frontera de arquitectura

**Subagente**
- tipo: `architect-reviewer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)

**Files**
- Create: [tests/architecture](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tests/architecture)
- Create: [docs/superpowers/specs/2026-03-24-architecture-boundaries.md](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/docs/superpowers/specs/2026-03-24-architecture-boundaries.md)

**Must not touch**
- páginas funcionales
- dominio fiscal

- [ ] Definir reglas verificables:
  - `app` no decide negocio
  - `components` no recomponen lógica fiscal
  - `models` no importan UI
  - `lib` no decide producto
- [ ] Añadir tests o checks ligeros de frontera.
- [ ] Documentar excepciones permitidas actuales.

### Task 0.3: Congelar fachadas públicas

**Subagente**
- tipo: `typescript-pro`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Modify: [models/attention.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/attention.ts)
- Modify: [models/organizations.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/organizations.ts)
- Modify: [models/fiscal/legal-archive.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/fiscal/legal-archive.ts)
- Modify: [models/workflow/read-api.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/read-api.ts)
- Create: [docs/superpowers/specs/2026-03-24-public-facades-map.md](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/docs/superpowers/specs/2026-03-24-public-facades-map.md)

**Must not touch**
- layout visual
- Server Actions de negocio

- [ ] Identificar entrypoints públicos que se mantienen estables.
- [ ] Documentar qué se puede partir por dentro y qué no.
- [ ] Dejar fachadas finas o explícitas donde aún estén mezcladas.

## Phase 1: Slice Documental

### Task 1.1: Consolidar readers y wiring documental

**Subagente**
- tipo: `nextjs-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$nextjs-15](/Users/uxiomarcosmacmini/.agents/skills/nextjs-15/SKILL.md)
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)

**Files**
- Modify: [models/workflow/document-read-api.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/document-read-api.ts)
- Modify: [app/(app)/dashboard/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/dashboard/page.tsx)
- Modify: [app/(app)/unsorted/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/unsorted/page.tsx)
- Modify: [app/(app)/capture/inbox/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/capture/inbox/page.tsx)
- Modify: tests de wiring del slice documental

**Must not touch**
- `components/ui/*`
- `models/fiscal/*`

- [ ] Asegurar que `dashboard`, `unsorted` y `capture` leen la read API estable o fallback bajo flag.
- [ ] Añadir paridad real legacy vs next.
- [ ] Añadir smoke crítico del slice documental.

### Task 1.2: Trocear `analyze-form`

**Subagente**
- tipo: `react-specialist`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills:
  - [$react-19](/Users/uxiomarcosmacmini/.agents/skills/react-19/SKILL.md)
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)

**Files**
- Modify: [components/unsorted/analyze-form.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/components/unsorted/analyze-form.tsx)
- Create: [components/unsorted](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/components/unsorted)
- Modify: tests del componente

**Must not touch**
- server actions
- `models/unsorted-inbox.ts`

- [ ] Separar polling.
- [ ] Separar estado derivado.
- [ ] Separar render de cabecera/acciones/detalle.
- [ ] Mantener comportamiento exacto.

### Task 1.3: Cleanup legacy documental

**Subagente**
- tipo: `qa-expert`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)
  - [$systematic-debugging](/Users/uxiomarcosmacmini/.codex/superpowers/skills/systematic-debugging/SKILL.md)

**Files**
- Modify: write set residual del slice documental

**Must not touch**
- slices fiscales
- slices de ops

- [ ] Eliminar duplicación solo si Gate C está en verde.
- [ ] Mantener flags reversibles.
- [ ] Cerrar runbook de rollback documental.

## Phase 2: Slice Fiscal

### Task 2.1: Partir `fiscal-read-api` por submódulos

**Subagente**
- tipo: `typescript-pro`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)

**Files**
- Modify: [models/workflow/fiscal-read-api.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/fiscal-read-api.ts)
- Create: [models/workflow/fiscal](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/fiscal)
- Modify: tests workflow fiscal

**Must not touch**
- `app/(app)/tax/page.tsx`
- `models/fiscal/legal-archive.ts`

- [ ] Extraer `quarterly`.
- [ ] Extraer `annual`.
- [ ] Extraer `archive`.
- [ ] Mantener la misma API pública.

### Task 2.2: Limpiar `tax/page.tsx`

**Subagente**
- tipo: `nextjs-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$nextjs-15](/Users/uxiomarcosmacmini/.agents/skills/nextjs-15/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Modify: [app/(app)/tax/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/tax/page.tsx)
- Modify: tests de wiring fiscal

**Must not touch**
- `components/tax/*`
- cálculo fiscal de dominio

- [ ] Dejar la página como composición.
- [ ] Quitar recomputación fiscal ya existente en read APIs.
- [ ] Mantener fallback bajo flag donde aplique.

### Task 2.3: Partir `legal-archive`

**Subagente**
- tipo: `typescript-pro`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)

**Files**
- Modify: [models/fiscal/legal-archive.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/fiscal/legal-archive.ts)
- Create: [models/fiscal/legal-archive](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/fiscal/legal-archive)
- Modify: tests de archive

**Must not touch**
- pages de archive
- `filing-dossiers`

- [ ] Separar manifest.
- [ ] Separar attachment resolution.
- [ ] Separar filings.
- [ ] Mantener fachada pública.

### Task 2.4: Cleanup legacy fiscal

**Subagente**
- tipo: `qa-expert`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$systematic-debugging](/Users/uxiomarcosmacmini/.codex/superpowers/skills/systematic-debugging/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Modify: duplicaciones fiscales residuales

**Must not touch**
- transacciones profundas

- [ ] Cerrar paridad fiscal.
- [ ] Borrar duplicación residual solo con gates verdes.

## Phase 3: Slice Transacciones

### Task 3.1: Partir `transaction-read-api`

**Subagente**
- tipo: `typescript-pro`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)

**Files**
- Modify: [models/workflow/transaction-read-api.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/transaction-read-api.ts)
- Create: [models/workflow/transactions](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/workflow/transactions)
- Modify: tests workflow tx

**Must not touch**
- UI de transacciones

- [ ] Separar lista.
- [ ] Separar detalle.
- [ ] Separar fiscal panel adapter.
- [ ] Mantener fachada actual.

### Task 3.2: Limpiar `transactions/[transactionId]/page.tsx`

**Subagente**
- tipo: `nextjs-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$nextjs-15](/Users/uxiomarcosmacmini/.agents/skills/nextjs-15/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Modify: [app/(app)/transactions/[transactionId]/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/transactions/%5BtransactionId%5D/page.tsx)
- Modify: tests detail wiring

**Must not touch**
- `components/transactions/fiscal-panel.tsx`

- [ ] Dejar la página como orquestador.
- [ ] Quitar ensamblado fiscal duplicado.

### Task 3.3: Partir `fiscal-panel`

**Subagente**
- tipo: `react-specialist`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills:
  - [$react-19](/Users/uxiomarcosmacmini/.agents/skills/react-19/SKILL.md)
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)

**Files**
- Modify: [components/transactions/fiscal-panel.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/components/transactions/fiscal-panel.tsx)
- Create: [components/transactions/fiscal-panel](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/components/transactions/fiscal-panel)
- Modify: tests UI del panel

**Must not touch**
- actions fiscales

- [ ] Separar bloques:
  - payment
  - IVA
  - retenciones
  - contraparte
- [ ] Mantener comportamiento exacto.

### Task 3.4: Cleanup legacy transacciones

**Subagente**
- tipo: `qa-expert`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$systematic-debugging](/Users/uxiomarcosmacmini/.codex/superpowers/skills/systematic-debugging/SKILL.md)

**Files**
- Modify: duplicación residual del slice tx

**Must not touch**
- fiscal archive
- organizations

- [ ] Cerrar paridad tx.
- [ ] Eliminar duplicación residual.

## Phase 4: Organizaciones y Ops

### Task 4.1: Partir `models/organizations.ts`

**Subagente**
- tipo: `typescript-pro`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)

**Files**
- Modify: [models/organizations.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/organizations.ts)
- Create: [models/organizations](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/models/organizations)
- Modify: tests de organizations

**Must not touch**
- `app/(app)/ops/*`

- [ ] Separar:
  - bootstrap
  - provisioning
  - current organization
  - helpers de naming
- [ ] Mantener fachada pública.

### Task 4.2: Reducir acoplamiento de Ops

**Subagente**
- tipo: `nextjs-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills:
  - [$nextjs-15](/Users/uxiomarcosmacmini/.agents/skills/nextjs-15/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Modify: [app/(app)/ops/actions.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/ops/actions.ts)
- Modify: [app/(app)/ops/page.tsx](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/%28app%29/ops/page.tsx)
- Modify: [components/ops](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/components/ops)
- Modify: tests ops

**Must not touch**
- dominio fiscal

- [ ] Dejar ops como composición + acciones finas.
- [ ] Quitar lógica repartida innecesaria.

## Phase 5: Endurecimiento Final

### Task 5.1: Unificar verificación y gates

**Subagente**
- tipo: `qa-expert`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)
  - [$playwright](/Users/uxiomarcosmacmini/.agents/skills/playwright/SKILL.md)

**Files**
- Modify: [package.json](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/package.json)
- Create: [scripts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/scripts)
- Create: runbook de verificación

**Must not touch**
- lógica de dominio

- [ ] Crear una orden única reproducible.
- [ ] Fijar criterios go/no-go por slice.

### Task 5.2: Endurecer build, primero lint

**Subagente**
- tipo: `typescript-pro`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)

**Files**
- Modify: [next.config.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/next.config.ts)
- Modify: configuración lint relevante

**Must not touch**
- features de producto

- [ ] Quitar `ignoreDuringBuilds` cuando el repo ya esté estable.

### Task 5.3: Endurecer tipado

**Subagente**
- tipo: `typescript-pro`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)

**Files**
- Modify: [tsconfig.json](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tsconfig.json)
- Modify: fixes focales derivados

**Must not touch**
- UI

- [ ] Reducir `allowJs` y/o `skipLibCheck` solo si todo lo anterior ya está verde.

### Task 5.4: Cleanup final y documentación

**Subagente**
- tipo: `architect-reviewer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills:
  - [$requesting-code-review](/Users/uxiomarcosmacmini/.codex/superpowers/skills/requesting-code-review/SKILL.md)

**Files**
- Modify: [ORCHESTRATOR.md](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/ORCHESTRATOR.md)
- Modify: specs/plan finales

**Must not touch**
- dominio funcional

- [ ] Documentar arquitectura resultante.
- [ ] Dejar deuda residual explícita.

## Dependency Graph

- Base: `0.1 -> 0.2 -> 0.3`
- Documental: `0.3 -> 1.1 -> 1.2 -> 1.3`
- Fiscal: `0.3 -> 2.1 -> 2.2` y `0.3 -> 2.1 -> 2.3 -> 2.4`
- Transacciones: `0.3 -> 3.1 -> 3.2 -> 3.3 -> 3.4`
- Organizaciones/Ops: `0.3 -> 4.1 -> 4.2`
- Final: `1.3 + 2.4 + 3.4 + 4.2 -> 5.1 -> 5.2 -> 5.3 -> 5.4`

## Recommended Start

1. `0.1`
2. `0.2`
3. `0.3`
4. en paralelo:
   - `1.1`
   - `2.1`
   - `4.1`

## Success Definition

El plan se considera cerrado cuando:
- los change paths críticos tocan menos archivos y menos capas
- `app` compone y `models` decide
- la duplicación semántica entre páginas y read APIs desaparece
- los hotspots quedan partidos detrás de fachadas estables
- existe `verify:critical`
- el build deja de depender de tolerancias provisionales

