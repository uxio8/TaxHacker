# Architecture Boundaries

## Scope

Task `0.2` del plan `compatibility-first-refactor`.

Objetivo: fijar reglas de frontera verificables con checks ligeros, sin tocar páginas funcionales ni dominio fiscal. El enforcement inicial vive en `tests/architecture/*` y se apoya en proxies estáticos, no en una reescritura.

## Reglas verificables

### app no decide negocio

Proxy verificable: cualquier import directo desde `models/fiscal/*` o `models/tax-forms/*` en `app/*` se trata como hotspot heredado y debe quedar en la allowlist actual.

Razón: `app/*` debe orquestar routing, auth, loaders y composición. Cuando una página o action importa motores fiscales o define helpers de decisión, el radio de cambio se dispara.

### components no recomponen lógica fiscal

Proxy verificable: cualquier import de `components/*` a `models/fiscal/*` o `models/tax-forms/*` debe ser `import type`, salvo constantes de presentación documentadas.

Razón: los componentes pueden depender de contratos de datos, pero no deben reusar motores, comandos ni selectors fiscales para reconstruir reglas de producto en la capa visual.

### models no importan UI

Proxy verificable: `models/*` no puede importar ni reexportar `app/*` ni `components/*` mediante imports estáticos o reexports estáticos.

Razón: el dominio y los read models deben ser consumibles sin arrastrar UI.

### lib no decide producto

Proxy verificable: `lib/*` no puede depender de `components/*` ni `models/*` fuera de la lista cerrada de adaptadores y acoplamientos heredados documentados.

Razón: `lib/*` debe quedarse en infraestructura técnica y helpers puros. Si decide producto o depende de modelo de negocio, se vuelve una capa ambigua difícil de mover.

## Checks ligeros

Los checks viven en `tests/architecture/boundaries.test.mjs` y `tests/architecture/parser.test.mjs` y hacen esto:

- recorren `app`, `components`, `models` y `lib`
- inspeccionan imports estáticos, imports laterales y reexports estáticos
- comparan el estado real contra una allowlist cerrada en `tests/architecture/rules.mjs`
- fallan si aparece un nuevo acoplamiento fuera de la lista documentada

Esto no intenta demostrar pureza absoluta. Intenta congelar el drift actual para que el refactor futuro quite excepciones en vez de añadir más.

## Excepciones permitidas actuales

### app: hotspots fiscales heredados permitidos

Estos archivos siguen importando directamente `models/fiscal/*` o `models/tax-forms/*` y quedan tolerados mientras no se extraigan los slices:

- `app/(app)/apps/invoices/actions.ts`
- `app/(app)/capture/inbox/page.tsx`
- `app/(app)/settings/actions.ts`
- `app/(app)/settings/fiscal/page.tsx`
- `app/(app)/tax/archive/[periodId]/page.tsx`
- `app/(app)/tax/archive/annual/actions.ts`
- `app/(app)/tax/archive/annual/page.tsx`
- `app/(app)/tax/archive/page.tsx`
- `app/(app)/tax/close/actions.ts`
- `app/(app)/tax/close/page.tsx`
- `app/(app)/tax/counterparties/actions.ts`
- `app/(app)/tax/counterparties/page.tsx`
- `app/(app)/tax/forms/111/page.tsx`
- `app/(app)/tax/forms/115/page.tsx`
- `app/(app)/tax/forms/180/page.tsx`
- `app/(app)/tax/forms/303/page.tsx`
- `app/(app)/tax/forms/347/page.tsx`
- `app/(app)/tax/forms/349/page.tsx`
- `app/(app)/tax/forms/390/page.tsx`
- `app/(app)/tax/forms/[obligationCode]/evidence/actions.ts`
- `app/(app)/tax/forms/page.tsx`
- `app/(app)/tax/page.tsx`
- `app/(app)/tax/quarters/[periodId]/page.tsx`
- `app/(app)/tax/quarters/page.tsx`
- `app/(app)/tax/review/actions.ts`
- `app/(app)/tax/review/page.tsx`
- `app/(app)/transactions/[transactionId]/page.tsx`
- `app/(app)/transactions/actions.ts`
- `app/(app)/transactions/fiscal-actions.ts`
- `app/(app)/transactions/fiscal-panel-shared.ts`
- `app/(app)/unsorted/actions.ts`
- `app/(app)/unsorted/page.tsx`

Notas:

- `app/(app)/tax/page.tsx` sigue calculando vencimientos, estados y next actions.
- `app/(app)/transactions/fiscal-panel-shared.ts` sigue recomponiendo asignaciones y razones de auditoría.
- `app/(app)/transactions/actions.ts`, `app/(app)/unsorted/actions.ts` y `app/(app)/apps/invoices/actions.ts` siguen orquestando sync fiscal post-write.

### components: excepciones de valor permitidas

Todo import fiscal en `components/*` debe ser `import type`, salvo estas constantes de presentación:

- `components/tax/forms/303/model-303-draft-view.tsx` -> `@/models/tax-forms/model-303`
- `components/tax/forms/390/model-390-draft-view.tsx` -> `@/models/tax-forms/model-303`
- `components/tax/review/review-status-badge.tsx` -> `@/models/fiscal/review-status`

Son excepciones toleradas porque hoy solo alimentan badges, tablas y trazas visuales. Si empiezan a arrastrar cálculo o branching de negocio, deben salir de `components/*`.

### models: excepciones actuales

Hay una excepción heredada permitida hoy:

- `models/mobile/capture.ts` -> `../../app/(app)/unsorted/actions.ts`

Nota:

- este cruce existe porque la captura móvil reutiliza la server action que arranca el análisis en `unsorted`; se tolera solo para congelar el estado actual y no abrir nuevos cruces `models -> app`.

### lib: adaptadores y acoplamientos heredados permitidos

Imports a `components/*` permitidos:

- `lib/email.ts` -> `@/components/emails/newsletter-welcome-email`
- `lib/email.ts` -> `@/components/emails/otp-email`

Imports a `models/*` permitidos:

- `lib/analysis-worker.ts` -> `../models/billing/usage.ts`
- `lib/auth.ts` -> `@/models/billing/runtime`
- `lib/auth.ts` -> `@/models/support-access`
- `lib/auth.ts` -> `@/models/users`
- `lib/billing/guards.ts` -> `@/models/billing/access`
- `lib/files.ts` -> `../models/billing/access.ts`
- `lib/files.ts` -> `../models/memberships.ts`
- `lib/mobile-triage.ts` -> `../models/mobile/types.ts`
- `lib/mobile-triage-shared.ts` -> `../models/mobile/types.ts`
- `lib/tenant.ts` -> `../models/memberships.ts`
- `lib/tenant.ts` -> `../models/organizations.ts`
- `lib/tenant.ts` -> `../models/support-access.ts`

Notas:

- `lib/email.ts` es un adaptador de render y entrega de emails, no una surface visual interactiva.
- `lib/auth.ts`, `lib/tenant.ts`, `lib/files.ts` y `lib/billing/guards.ts` mezclan infraestructura con policy heredada; se documentan para impedir que aparezcan más cruces.

## Expected Use

Si el refactor mueve una excepción fuera de la lista, se actualiza `tests/architecture/rules.mjs` y esta spec para reflejar menos deuda.

Si aparece una excepción nueva, el test debe fallar hasta que haya decisión explícita. La política por defecto es `no nuevos cruces`.
