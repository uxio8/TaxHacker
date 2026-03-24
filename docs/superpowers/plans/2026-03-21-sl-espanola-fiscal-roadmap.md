# S.L. Espanola Fiscal Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert TaxHacker from a generic transaction/document tool into a practical fiscal workspace for a Spanish S.L. with employees and rent withholding, optimized first for quarterly close and advisor-ready outputs.

**Architecture:** Keep the current monolith and add a modular fiscal context on top of the existing transaction/document core. Do not rebuild capture/AI first; introduce canonical fiscal facts, fiscal periods, counterparties, close workflows, legal archive, and tax-form preparation as isolated modules with low write-set overlap.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, Server Actions, existing transaction/document models, node:test, ESLint, repository superpower skills.

---

## Planning Assumptions

- Target entity: Spanish S.L.
- Fiscal setup: natural fiscal year, quarterly VAT, outside SII.
- Confirmed by user:
  - has employees
  - has rent withholding
  - has no intra-EU operations
- Product strategy:
  - modular monolith, not microservices
  - advisor-ready and close-ready first
  - no promise of full autonomous corporate-tax calculation in V1

## Global Delivery Rules

- Orchestrator skill stack:
  - `writing-plans` for breakdown and handoff
  - `dispatching-parallel-agents` for independent workstreams
  - `subagent-driven-development` as default execution pattern
- Every implementation subagent must also use:
  - `test-driven-development`
  - `verification-before-completion`
- Use `systematic-debugging` for any mismatch in fiscal totals, snapshots, or exports.
- Use `requesting-code-review` before merging each milestone.
- Use `using-git-worktrees` for large milestones that touch Prisma plus UI plus exports.

## Workstreams

### Stream A: Fiscal Core

- Scope:
  - fiscal profile
  - counterparties
  - canonical fiscal facts per transaction
  - fiscal periods
  - close snapshots and auditability
- Primary files/modules:
  - `prisma/schema.prisma`
  - new `models/fiscal/*`
  - new `forms/fiscal/*`
  - selective hooks into `models/transactions.ts`
  - selective hooks into `app/(app)/transactions/actions.ts`

### Stream B: Fiscal Workspace UI

- Scope:
  - fiscal dashboard
  - quarterly close workspace
  - review queue
  - counterparty management
  - period states and issue lists
- Primary files/modules:
  - new `app/(app)/tax/*`
  - new `components/tax/*`
  - selective hooks into existing transaction filters/navigation

### Stream C: Outputs and Compliance

- Scope:
  - VAT books
  - model preparation
  - legal archive bundles
  - invoice compliance track for VERI*FACTU
- Primary files/modules:
  - new `models/tax-forms/*`
  - new `app/(app)/tax/forms/*`
  - new `app/(app)/tax/archive/*`
  - selective hooks into `app/(app)/apps/invoices/*`

## Phase 0: Fiscal Contract And Golden Dataset

### Task 0.1: Fiscal Domain Contract

**Objective:** Freeze the canonical fiscal vocabulary before touching Prisma.

**Subagent:** `business-analyst`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `brainstorming`, `writing-plans`
**Ownership:**
- Create: `docs/superpowers/specs/2026-03-21-fiscal-domain-contract.md`
- Do not touch code
**Deliverables:**
- Canonical fields for:
  - invoice identity
  - counterparty identity
  - VAT header plus tax lines model
  - VAT base/rate/quota per line
  - withholding base/rate/quota
  - deductibility
  - fiscal review status
  - period assignment
- Explicit out-of-scope list for V1
**Verification:**
- review by compliance-oriented subagent
- signoff against a real anonymized quarter
- This task is a hard prerequisite for any Prisma change

### Task 0.2: Golden Quarter Dataset

**Objective:** Build the acceptance dataset used to validate all later calculations.

**Subagent:** `data-researcher`
**Model:** `gpt-5.4-mini`
**Reasoning:** `medium`
**Skills:** `dispatching-parallel-agents`
**Ownership:**
- Create: `docs/superpowers/specs/2026-03-21-golden-quarter-dataset.md`
- Create: `tests/fixtures/fiscal/golden-quarter.json`
**Deliverables:**
- Anonymized examples for:
  - received invoices with deductible VAT
  - rent invoice with withholding
  - payroll-related withholding placeholders
  - issued invoices
  - non-deductible expenses
  - mixed VAT-rate documents
  - mixed deductible/non-deductible documents
**Verification:**
- fixture file loads in tests
- reviewed by fiscal-domain owner
- fixture includes expected outputs for:
  - review status
  - VAT book lines
  - quarterly 303 totals
  - quarterly 115 totals

## Phase 1: Fiscal Core Foundations

### Task 1.1: Fiscal Profile

**Objective:** Add a first-class fiscal profile separate from visual business settings.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `prisma/schema.prisma`
- Create: `models/fiscal/profile.ts`
- Create: `forms/fiscal/profile.ts`
- Create/Modify: `app/(app)/settings/fiscal/*`
- Do not touch tax forms or close workflow yet
**Verification:**
- Prisma migration applies
- unit tests for validation and model access
- build and lint for touched files

### Task 1.2: Counterparties

**Objective:** Introduce a stable master for suppliers/customers/landlords.

**Subagent:** `fullstack-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `prisma/schema.prisma`
- Create: `models/fiscal/counterparties.ts`
- Create: `forms/fiscal/counterparties.ts`
- Create: `app/(app)/tax/counterparties/*`
- Create: `components/tax/counterparties/*`
**Verification:**
- CRUD tests
- dedupe key tests
- lint/build for touched files

### Task 1.3: Transaction Fiscal Facts

**Objective:** Add the canonical fiscal layer over generic transactions using header plus tax lines when needed.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `prisma/schema.prisma`
- Create: `models/fiscal/transaction-fiscal.ts`
- Create: `forms/fiscal/transaction-fiscal.ts`
- Create: `tests/models/fiscal/transaction-fiscal.test.mjs`
- Read-only reference: `models/transactions.ts`, `forms/transactions.ts`
**Verification:**
- explicit mapping tests from transaction input to fiscal facts
- golden-quarter fixtures partially pass

### Task 1.4: Review State Engine

**Objective:** Mark every transaction as `ready`, `needs_review`, or `blocked`.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `models/fiscal/transaction-fiscal.ts`
- Create: `models/fiscal/review-status.ts`
- Create: `tests/models/fiscal/review-status.test.mjs`
**Verification:**
- state transition tests
- golden-quarter review coverage report

## Phase 2: Fiscal Workspace MVP

### Task 2.1: Tax Navigation And Landing

**Objective:** Create a separate fiscal workspace without disturbing current transaction UX.

**Subagent:** `frontend-developer`
**Model:** `gpt-5.4-mini`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `app/(app)/tax/page.tsx`
- Create: `components/tax/layout/*`
- Modify minimally: authenticated navigation/sidebar
**Verification:**
- route loads
- lint/build

### Task 2.2: Quarterly Draft Workspace

**Objective:** Show a draft fiscal quarter with drilldown to source transactions/files.

**Subagent:** `fullstack-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `app/(app)/tax/quarters/[periodId]/page.tsx`
- Create: `components/tax/quarters/*`
- Create: `models/fiscal/quarterly-draft.ts`
**Verification:**
- tests on quarter aggregates
- manual drilldown works against fixtures
- Hard prerequisites:
  - Task 1.4 complete
  - Task 3.1 complete

### Task 2.3: Issue Queue

**Objective:** Expose the fiscal review queue and unblock the quarter close workflow.

**Subagent:** `frontend-developer`
**Model:** `gpt-5.4-mini`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `app/(app)/tax/review/*`
- Create: `components/tax/review/*`
- Read-only use of fiscal fact status services
**Verification:**
- UI tests if available
- lint/build
- Hard prerequisites:
  - Task 1.4 complete
  - Task 3.1 complete

## Phase 3: Fiscal Periods And VAT Books

### Task 3.1: Fiscal Periods

**Objective:** Persist periods and remove dependence on ad hoc date filters.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `prisma/schema.prisma`
- Create: `models/fiscal/periods.ts`
- Create: `tests/models/fiscal/periods.test.mjs`
**Verification:**
- period creation/state tests
- deterministic assignment tests

### Task 3.2: VAT Books

**Objective:** Build reproducible issued/received VAT books from fiscal facts.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `models/fiscal/vat-books.ts`
- Create: `tests/models/fiscal/vat-books.test.mjs`
- Read-only use of transaction and fiscal fact layers
**Verification:**
- golden-quarter VAT book matches expected lines

### Task 3.3: Period Snapshots

**Objective:** Make VAT books and draft values reproducible at close time.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `prisma/schema.prisma`
- Create: `models/fiscal/snapshots.ts`
- Create: `tests/models/fiscal/snapshots.test.mjs`
**Verification:**
- idempotent rebuild tests
- snapshot immutability tests

## Phase 4: Close Workflow And Auditability

### Task 4.1: Close And Reopen Workflow

**Objective:** Close periods safely and prevent silent breakage after filing.

**Subagent:** `fullstack-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `prisma/schema.prisma`
- Create: `models/fiscal/close.ts`
- Create: `app/(app)/tax/close/*`
- Create: `components/tax/close/*`
- Selective touch: transaction actions only for guards
**Verification:**
- closed-period mutation tests
- reopen-with-reason tests

### Task 4.2: Audit Log

**Objective:** Record who changed what after fiscal facts exist.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Modify: `prisma/schema.prisma`
- Create: `models/fiscal/audit-log.ts`
- Create: `tests/models/fiscal/audit-log.test.mjs`
**Verification:**
- audit event tests on edit/close/reopen

## Phase 5: Models For Advisor-Ready Outputs

### Task 5.1: Model 303

**Objective:** Prepare a traceable quarterly VAT draft.

**Subagent:** `fintech-engineer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `models/tax-forms/model-303.ts`
- Create: `app/(app)/tax/forms/303/*`
- Create: `tests/models/tax-forms/model-303.test.mjs`
**Verification:**
- golden-quarter expected totals
- drilldown links to source lines

### Task 5.2: Model 115

**Objective:** Prepare quarterly rent withholding draft.

**Subagent:** `fintech-engineer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `models/tax-forms/model-115.ts`
- Create: `app/(app)/tax/forms/115/*`
- Create: `tests/models/tax-forms/model-115.test.mjs`
**Verification:**
- rent-withholding fixture totals

### Task 5.3: Model 111 Readiness Gate

**Objective:** Decide whether to support 111 directly or only via payroll import.

**Subagent:** `business-analyst`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `brainstorming`, `writing-plans`
**Ownership:**
- Create: `docs/superpowers/specs/2026-03-21-model-111-scope.md`
**Verification:**
- explicit decision document:
  - import payroll first
  - or support manual quarterly summary only

### Task 5.4: Annual Models

**Objective:** Add annual outputs only after quarterly sources are stable.

**Subagent:** `fintech-engineer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create incrementally:
  - `models/tax-forms/model-390.ts`
  - `models/tax-forms/model-180.ts`
  - `models/tax-forms/model-347.ts`
- Create matching routes/components/tests
**Verification:**
- annual aggregates reconcile against quarterly drafts
- Hard prerequisites:
  - Task 5.1 complete for `390`
  - Task 5.2 complete for `180`
  - Task 5.3 explicitly approves payroll source or manual 111 scope before any `190` work

### Task 5.5: Corporate Tax Advisor Pack

**Objective:** Support model 200 indirectly first.

**Subagent:** `fintech-engineer`
**Model:** `gpt-5.4`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `app/(app)/tax/forms/200-pack/*`
- Create: `models/tax-forms/model-200-pack.ts`
- Do not promise full automated model 200 logic in V1
**Verification:**
- package includes exports and reconciliations needed by advisor
- This task is outside the MVP quarterly train

### Task 5.6: Model 190 Conditional Track

**Objective:** Prepare annual payroll-withholding output only if the 111 gate is resolved.

**Subagent:** `fintech-engineer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create conditionally:
  - `models/tax-forms/model-190.ts`
  - matching routes/components/tests
**Verification:**
- must not start before Task 5.3 resolves payroll source and scope

## Phase 6: Legal Archive And Invoice Compliance

### Task 6.1: Legal Archive Bundle

**Objective:** Produce period-based evidence bundles.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`
**Ownership:**
- Create: `models/fiscal/legal-archive.ts`
- Create: `app/(app)/tax/archive/*`
- Create: `tests/models/fiscal/legal-archive.test.mjs`
**Verification:**
- bundle contains manifest and expected sources

### Task 6.2: VERI*FACTU Track

**Objective:** Separate compliance workstream for issued invoices.

**Subagent:** `api-designer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `brainstorming`, `writing-plans`
**Ownership:**
- Create: `docs/superpowers/specs/2026-03-21-verifactu-track.md`
- Later implementation must own `app/(app)/apps/invoices/*`, dedicated compliance models, and QR/hash/event chain modules
**Verification:**
- compliance design reviewed against current AEAT/BOE requirements

## Parallel Execution Rules

- Parallel lane 1:
  - Task 0.1 Fiscal Domain Contract
  - Task 0.2 Golden Quarter Dataset
- Parallel lane 2 after 0.1:
  - Task 1.1 Fiscal Profile
  - Task 1.2 Counterparties
- Parallel lane 3 after 1.1 and 1.2:
  - Task 1.3 Transaction Fiscal Facts
  - Task 2.1 Tax Navigation And Landing
- Parallel lane 4 after 1.3:
  - Task 1.4 Review State Engine
  - Task 3.1 Fiscal Periods
- Parallel lane 5 after 1.4 and 3.1:
  - Task 2.2 Quarterly Draft Workspace
  - Task 2.3 Issue Queue
  - Task 3.2 VAT Books
- Parallel lane 6 after 3.1 and 3.2:
  - Task 3.3 Period Snapshots
  - Task 4.1 Close And Reopen Workflow
  - Task 6.1 Legal Archive Bundle
- Parallel lane 7 after quarterly outputs are trusted:
  - Task 5.1 Model 303
  - Task 5.2 Model 115
  - Task 5.3 Model 111 Readiness Gate
- Parallel lane 8 after 5.1, 5.2 and 5.3:
  - annual models except `190`
  - Task 5.6 Model 190 Conditional Track only if 5.3 unlocks it
  - corporate tax advisor pack
  - VERI*FACTU design/implementation stream

## Non-Goals For Initial Execution

- No intra-EU 349 flow in first implementation train.
- No SII/REDEME.
- No full autonomous payroll engine.
- No full autonomous corporate-tax calculator.
- No microservice split.

## Milestone Gates

- Milestone A:
  - every relevant transaction can produce fiscal facts and review status
- Milestone B:
  - one quarter can be reviewed and explained line by line
- Milestone C:
  - 303 and 115 drafts reconcile with source documents
- Milestone D:
  - closed periods are reproducible and auditable
- Milestone E:
  - annual summaries and advisor pack are exportable
- Milestone F:
  - either VERI*FACTU-ready invoicing for Spain exists, or Spanish invoice emission is explicitly gated off

## MVP Commercial Scope

- MVP promise:
  - fiscal facts
  - periods
  - close workflow
  - 303
  - 115
  - legal archive
  - advisor-ready exports
- Not in MVP promise:
  - full automated 111 without payroll source
  - 190 unless 111 gate is resolved
  - full automated model 200
