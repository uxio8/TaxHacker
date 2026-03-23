# Counterparty Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `missing_counterparty_relation` from a vague review warning into a legally informed, evidence-based counterparty resolution flow for Spain, with conservative auto-linking, explicit human confirmation paths, and auditability.

**Architecture:** Keep the current fiscal monolith and add a focused counterparty-resolution layer between fiscal sync/review and the transaction/review UI. Reuse the existing canonical counterparty model and fiscal audit log, but separate legal identification facts from the product-level concept of a canonical linked counterparty.

**Tech Stack:** Next.js 15 App Router, React 19, Server Actions, Prisma, PostgreSQL, node:test, existing `models/fiscal/*`, repository superpower skills.

---

## Planning Assumptions

- Jurisdiction: Spain.
- Date of legal review used for this plan: `2026-03-22`.
- Base policy for V1: `conservadora`.
- Conservative policy means:
  - auto-link only on exact normalized NIF match
  - only if there is exactly one active candidate
  - only if there are no conflicts or prior human rejections
  - all other cases stay in review or require explicit confirmation
- V1 will not implement fuzzy auto-linking without NIF.
- V1 will not treat canonical counterparty linkage as a universal legal requirement for every document type; that decision will be encoded explicitly per flow.

## Legal/Product Findings That Drive The Design

- Spain requires different identification minima depending on the document and workflow:
  - full invoice
  - simplified invoice
  - VAT books
  - SII
  - rent withholding information for model 180
- A stable `counterparty_id` is a product control, not a direct one-size-fits-all legal obligation.
- The product still needs canonical linkage because it affects:
  - consistent third-party identity
  - review workflow quality
  - future grouping and traceability
  - withholding/rent flows with higher fiscal sensitivity
- The current label "Hay que confirmar la relacion con la contraparte" is too ambiguous. The system should distinguish:
  - legally required identifying data missing
  - canonical counterparty linkage unresolved

## Global Delivery Rules

- Orchestrator skill stack:
  - `brainstorming` for policy framing and UX/design choices
  - `writing-plans` for this plan
  - `dispatching-parallel-agents` for independent implementation slices
  - `subagent-driven-development` as default execution mode
- Every implementation subagent must also use:
  - `test-driven-development`
  - `verification-before-completion`
- Use `systematic-debugging` if the new rules produce unexpected review transitions or regressions in VAT/withholding readiness.
- Use `requesting-code-review` after each phase.

## Code Areas In Scope

- Review rules and readiness:
  - `models/fiscal/review-status.ts`
  - `tests/models/fiscal/review-status.test.mjs`
- Fiscal sync and persistence:
  - `models/fiscal/sync.ts`
  - `models/fiscal/transaction-fiscal.ts`
  - `tests/models/fiscal/transaction-fiscal.test.mjs`
- Counterparty identity/master data:
  - `models/fiscal/counterparties.ts`
  - `app/(app)/tax/counterparties/actions.ts`
  - `components/tax/counterparties/*`
- Audit log:
  - `models/fiscal/audit-log.ts`
  - tests under `tests/models/fiscal/*`
- Transaction detail UI and actions:
  - `components/transactions/fiscal-panel.tsx`
  - `app/(app)/transactions/fiscal-actions.ts`
  - `app/(app)/transactions/fiscal-panel-shared.ts`
- Review queue UI:
  - `components/tax/review/review-queue-list.tsx`
  - `components/tax/review/review-status-badge.tsx`
  - `app/(app)/tax/review/page.tsx`
- Potential schema work:
  - `prisma/schema.prisma`

## Proposed New Modules

- `models/fiscal/counterparty-resolution.ts`
  - decision engine
  - candidate selection
  - materiality bucket
  - evidence packaging
- `tests/models/fiscal/counterparty-resolution.test.mjs`
  - unit coverage for decision outcomes
- `components/transactions/counterparty-resolution-card.tsx`
  - focused UI for resolution in transaction detail
- `components/tax/review/counterparty-resolution-panel.tsx`
  - optional shared UI for review queue drilldown if needed

## Phase 0: Policy And Naming Contract

### Task 0.1: Counterparty Resolution Policy Matrix

**Objective:** Freeze the policy matrix before touching implementation rules.

**Subagent:** `business-analyst`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `brainstorming`, `writing-plans`
**Ownership:**
- Create: `docs/superpowers/specs/2026-03-22-counterparty-resolution-policy.md`
- Read-only reference:
  - `models/fiscal/review-status.ts`
  - `models/fiscal/sync.ts`
  - `models/tax-forms/model-115.ts`
  - `models/fiscal/vat-books.ts`
**Deliverables:**
- Document matrix by flow:
  - received invoice
  - issued invoice
  - simplified invoice
  - rent withholding
  - future SII-sensitive flows
- Decision per flow:
  - when canonical linkage is optional
  - when canonical linkage is recommended
  - when canonical linkage is required to clear review
- Copy/naming guidance:
  - replacement text for ambiguous review reason
  - separation between legal-data gap and canonical-link gap
**Verification:**
- reviewed by `risk-manager`
- approved before any code changes to review rules
- [ ] Write the spec document
- [ ] Review current rules and flows
- [ ] Encode the conservative policy matrix
- [ ] Define naming and status semantics
- [ ] Dispatch reviewer and resolve comments

### Task 0.2: Technical Boundary Review

**Objective:** Lock clean boundaries so the resolution engine does not sprawl into UI and sync code.

**Subagent:** `architect-reviewer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `brainstorming`
**Ownership:**
- No code changes
- Review-only on:
  - `models/fiscal/*`
  - `components/transactions/*`
  - `components/tax/review/*`
**Deliverables:**
- Confirmed module boundaries for:
  - decision engine
  - audit appenders
  - UI orchestration
  - sync integration
**Verification:**
- architecture note appended to spec
- [ ] Review policy matrix
- [ ] Review current file boundaries
- [ ] Approve or request boundary changes

## Phase 1: Resolution Domain And Auditability

### Task 1.1: Counterparty Resolution Engine

**Objective:** Create the domain engine that decides `auto_linked`, `suggested_requires_confirmation`, or `needs_review_no_safe_candidate`.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`, `typescript`
**Ownership:**
- Create: `models/fiscal/counterparty-resolution.ts`
- Create: `tests/models/fiscal/counterparty-resolution.test.mjs`
- Modify minimally:
  - `models/fiscal/counterparties.ts`
- Do not touch UI in this task
**Deliverables:**
- normalized candidate lookup by NIF
- active/inactive filtering
- duplicate/conflict detection
- materiality classification
- deterministic decision result object
**Verification:**
- unit tests for:
  - exact unique active NIF match
  - duplicate by NIF
  - inactive exact match
  - name-only candidate
  - prior manual rejection
- [ ] Write failing tests for decision outcomes
- [ ] Implement minimal decision types and rules
- [ ] Add candidate lookup helpers
- [ ] Run targeted tests
- [ ] Self-review conflict edge cases

### Task 1.2: Review Status Refactor

**Objective:** Replace the current generic reason check with the new counterparty-resolution policy.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`, `typescript`
**Ownership:**
- Modify:
  - `models/fiscal/review-status.ts`
  - `tests/models/fiscal/review-status.test.mjs`
- Read-only reference:
  - `models/fiscal/counterparty-resolution.ts`
**Deliverables:**
- new reason semantics
- explicit mapping from policy matrix to review reasons
- no silent promotion to `ready`
- preserved VAT/withholding readiness behavior unless policy says otherwise
**Verification:**
- regression tests for existing blocking reasons
- new tests for:
  - low-risk missing canonical link
  - rent withholding stricter path
  - exact NIF auto-link path
- [ ] Add failing tests for policy-driven review states
- [ ] Refactor reason derivation
- [ ] Preserve existing unrelated behaviors
- [ ] Run review-status tests
- [ ] Validate no regressions in VAT/withholding tests

### Task 1.3: Fiscal Audit Events For Resolution

**Objective:** Make every automatic or human counterparty resolution auditable.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`, `typescript`
**Ownership:**
- Modify:
  - `models/fiscal/audit-log.ts`
- Create:
  - `tests/models/fiscal/audit-log-counterparty.test.mjs`
- Potentially modify:
  - `prisma/schema.prisma` only if existing payload limits force schema changes
**Deliverables:**
- new event names for:
  - auto-linked
  - suggested
  - confirmed
  - rejected
  - created-and-linked
- payload shape with:
  - rule version
  - evidence snapshot
  - candidate set summary
  - before/after state
**Verification:**
- append/list tests for new events
- payload validation tests
- [ ] Add failing tests for new audit events
- [ ] Extend event constants and payload typing
- [ ] Wire normalization and parsing
- [ ] Run audit-log tests
- [ ] Review payload size and backwards compatibility

## Phase 2: Sync Integration And Transaction Workflow

### Task 2.1: Sync Hook For Conservative Auto-Linking

**Objective:** Apply the conservative auto-link rule during fiscal sync without introducing fuzzy automation.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`, `typescript`
**Ownership:**
- Modify:
  - `models/fiscal/sync.ts`
  - `models/fiscal/transaction-fiscal.ts`
  - `tests/models/fiscal/transaction-fiscal.test.mjs`
- Read-only reference:
  - `models/fiscal/counterparty-resolution.ts`
  - `models/fiscal/audit-log.ts`
**Deliverables:**
- call resolution engine during sync/rebuild
- auto-fill `counterparty_id` only on safe exact-NIF match
- append fiscal audit event on auto-link
- leave unresolved cases in review with machine-readable state
**Verification:**
- sync tests covering:
  - exact match
  - duplicate match
  - no match
  - inactive match
- [ ] Add failing sync tests
- [ ] Integrate resolution engine into sync path
- [ ] Append audit on safe auto-link
- [ ] Run sync and transaction-fiscal tests
- [ ] Review idempotency and re-sync behavior

### Task 2.2: Transaction Detail Resolution UI

**Objective:** Add a dedicated card in the transaction detail so the user can resolve counterparties explicitly.

**Subagent:** `frontend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`, `react-19`, `typescript`
**Ownership:**
- Create:
  - `components/transactions/counterparty-resolution-card.tsx`
- Modify:
  - `components/transactions/fiscal-panel.tsx`
  - `app/(app)/transactions/fiscal-actions.ts`
  - `app/(app)/transactions/fiscal-panel-shared.ts`
- Do not modify review queue yet
**Deliverables:**
- evidence summary in UI:
  - detected NIF
  - detected name
  - suggested candidate
  - conflict badges
  - materiality bucket
- explicit actions:
  - Confirmar vinculo
  - Elegir otra contraparte
  - Crear y vincular
  - Mantener en revision
- no generic `OK`
**Verification:**
- component tests or server-action tests for intent parsing
- manual flow check in transaction detail
- [ ] Add failing tests for action parsing/state transitions
- [ ] Build card UI with current design system
- [ ] Add explicit semantic actions
- [ ] Wire server action to domain engine and audit
- [ ] Run targeted tests and manual smoke check

### Task 2.3: Counterparty Picker And Create-And-Link Flow

**Objective:** Let the user choose an existing counterparty or create a new one from the resolution flow.

**Subagent:** `fullstack-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`, `react-19`, `typescript`
**Ownership:**
- Modify:
  - `models/fiscal/counterparties.ts`
  - `app/(app)/tax/counterparties/actions.ts`
  - `components/tax/counterparties/counterparty-form.tsx`
  - `app/(app)/transactions/fiscal-actions.ts`
- Create if needed:
  - `components/transactions/counterparty-picker.tsx`
**Deliverables:**
- searchable candidate list scoped to owner
- create-and-link path prefilled from document evidence
- rejection reason capture when user overrides suggestion
**Verification:**
- tests for:
  - create new counterparty from detected NIF/name
  - select existing active counterparty
  - reject suggestion and keep in review
- [ ] Add failing tests for picker/create flows
- [ ] Implement search/select helpers
- [ ] Implement create-and-link action
- [ ] Persist rejection/override reasons
- [ ] Run tests and manual smoke checks

## Phase 3: Review Queue And Product Semantics

### Task 3.1: Review Queue Copy And Status Upgrade

**Objective:** Make the review queue explain the actual pending action instead of a vague warning.

**Subagent:** `frontend-developer`
**Model:** `gpt-5.4-mini`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`, `react-19`, `typescript`
**Ownership:**
- Modify:
  - `components/tax/review/review-queue-list.tsx`
  - `components/tax/review/review-status-badge.tsx`
  - `components/tax/quarters/quarterly-shared.tsx`
  - `lib/i18n/messages.ts`
- Optionally create:
  - `components/tax/review/counterparty-resolution-panel.tsx`
**Deliverables:**
- clearer labels separating:
  - missing legal identifying data
  - unresolved canonical linkage
- candidate/conflict summary in the queue
- direct CTA to open the resolution flow
**Verification:**
- snapshot or rendering tests for labels
- manual review queue inspection
- [ ] Add failing UI assertions for new labels/CTAs
- [ ] Update copy and mapping functions
- [ ] Add pending-action summary rendering
- [ ] Run UI tests and manual smoke check
- [ ] Verify no misleading legal wording remains

### Task 3.2: Flow-Specific Strictness For Rent/Withholding

**Objective:** Apply stricter behavior to sensitive Spanish rent-withholding flows.

**Subagent:** `risk-manager`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `brainstorming`
**Ownership:**
- Review-first on:
  - `models/fiscal/review-status.ts`
  - `models/tax-forms/model-115.ts`
  - `components/tax/forms/115/model-115-draft-view.tsx`
- Implementation by paired `backend-developer`
**Deliverables:**
- approved rule for:
  - when unresolved linkage keeps rent docs in review
  - when missing tax ID is blocking
  - when model-115/model-180 related documents require stronger confirmation
**Verification:**
- written signoff appended to policy spec
- backend tests added in paired execution task
- [ ] Review rent/withholding rules
- [ ] Freeze stricter decision table
- [ ] Hand off concrete rule changes to backend implementer

### Task 3.3: Backend Enforcement For Sensitive Flows

**Objective:** Implement the stricter rules approved in Task 3.2.

**Subagent:** `backend-developer`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `subagent-driven-development`, `test-driven-development`, `typescript`
**Ownership:**
- Modify:
  - `models/fiscal/review-status.ts`
  - `models/tax-forms/model-115.ts`
  - `tests/models/fiscal/review-status.test.mjs`
  - `tests/models/fiscal/review-queue.test.mjs`
**Deliverables:**
- stricter enforcement for sensitive withholding flows
- no impact on unrelated VAT-only flows unless intended
**Verification:**
- tests for rent-specific review behavior
- [ ] Add failing tests for rent-sensitive paths
- [ ] Implement approved stricter rules
- [ ] Run fiscal review and model tests
- [ ] Confirm unaffected flows remain green

## Phase 4: Backfill, QA, And Rollout

### Task 4.1: Backfill And Repair Tools

**Objective:** Re-evaluate existing fiscal documents with the new resolution logic.

**Subagent:** `tooling-engineer`
**Model:** `gpt-5.4-mini`
**Reasoning:** `medium`
**Skills:** `subagent-driven-development`, `test-driven-development`, `typescript`
**Ownership:**
- Create:
  - `scripts/backfill-counterparty-resolution.ts`
- Modify if needed:
  - `package.json`
  - `models/fiscal/transaction-fiscal.ts`
**Deliverables:**
- dry-run mode
- summary output:
  - auto-linked count
  - still-in-review count
  - conflicts found
- no destructive writes without explicit flag
**Verification:**
- script test or fixture-backed dry-run check
- [ ] Add fixture-backed dry-run validation
- [ ] Implement script with dry-run and apply modes
- [ ] Run against sample/fixture data
- [ ] Review summary output for operator clarity

### Task 4.2: QA Matrix And Release Gate

**Objective:** Define the acceptance suite and release checklist before enabling the flow broadly.

**Subagent:** `qa-expert`
**Model:** `gpt-5.4`
**Reasoning:** `high`
**Skills:** `verification-before-completion`
**Ownership:**
- Create:
  - `docs/superpowers/specs/2026-03-22-counterparty-resolution-qa-matrix.md`
- Read-only reference:
  - all files touched in previous tasks
**Deliverables:**
- acceptance matrix for:
  - received invoice exact NIF match
  - simplified invoice without safe canonical link
  - duplicate/inactive conflicts
  - create-and-link flow
  - rent withholding stricter path
  - audit log emission
  - backfill dry-run
**Verification:**
- reviewed by final `reviewer`
- [ ] Build acceptance matrix
- [ ] Define mandatory commands and expected results
- [ ] Define manual smoke checklist
- [ ] Dispatch final reviewer

## Execution Strategy

- Execute Phases 1 and 2 with `subagent-driven-development`.
- Dispatch these implementation slices in parallel when dependencies allow:
  - Task 1.1 and Task 1.3
  - Task 2.2 and Task 2.3 after Task 1.1 lands
  - Task 3.1 can start once Task 2.2 has a stable action/state contract
- Keep Task 1.2 and Task 2.1 sequential because both alter review/sync behavior.

## Out Of Scope For This Plan

- fuzzy auto-linking without NIF
- ML ranking of counterparties
- OCR confidence scoring overhaul
- mass bulk-confirmation UI
- SII-specific transmission workflows
- cross-tenant/shared counterparty master

## Final Review Handoff

- After implementation:
  - dispatch `architect-reviewer` with `gpt-5.4`, `high`
  - dispatch `reviewer` with `gpt-5.4`, `high`
  - run `verification-before-completion`
- Merge only when:
  - policy spec is approved
  - review-state tests are green
  - audit-log tests are green
  - transaction-detail flow is manually smoke-tested
  - backfill runs in dry-run without surprises
