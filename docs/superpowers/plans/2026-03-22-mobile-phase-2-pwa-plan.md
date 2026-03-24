# Mobile Phase 2 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hacer instalable TaxHacker como web app móvil útil, reforzando el acceso a `Captura` e `Inbox` sin meterse aún en offline-first.

**Architecture:** fase 2 ligera, apoyada en el canal móvil ya existente. Se completa el manifest, se añade UX de instalación y se ajusta el shell en `display-mode: standalone`, sin tocar el backend de captura ni el flujo fiscal.

**Tech Stack:** Next.js 15 App Router, React 19, manifest web app, metadata de Next, cliente ligero para `beforeinstallprompt`, Playwright/manual validation.

---

### Task 1: Manifest y metadata instalable

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `react-19`, `nextjs-15`, `verification-before-completion`

**Files**
- Modify: `public/site.webmanifest`
- Modify: `app/layout.tsx`
- Modify: `app/(app)/layout.tsx`
- Test: `tests/app/pwa/manifest.test.mjs`

**Must not touch**
- `app/(app)/capture/*`
- `models/mobile/*`
- `ORCHESTRATOR.md`

- [ ] Definir manifest real con `name`, `short_name`, `description`, `start_url`, `scope`, `display`, colores e iconos.
- [ ] Añadir `shortcuts` para `Captura` e `Inbox móvil`.
- [ ] Alinear metadata de layouts para iconos y manifest.
- [ ] Escribir tests del contrato del manifest.
- [ ] Verificar con:
  - `node --test --experimental-strip-types tests/app/pwa/manifest.test.mjs`
  - `npx eslint 'app/layout.tsx' 'app/(app)/layout.tsx' 'tests/app/pwa/manifest.test.mjs'`

### Task 2: UX de instalación

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `react-19`, `tailwind-4`, `verification-before-completion`

**Files**
- Create: `components/pwa/install-prompt.tsx`
- Create: `components/pwa/use-install-prompt.ts`
- Modify: `app/(app)/capture/page.tsx`
- Modify: `components/sidebar/mobile-menu.tsx`
- Modify: `lib/i18n/messages.ts`
- Test: `tests/components/pwa/install-prompt.test.mjs`

**Must not touch**
- `models/mobile/*`
- `app/api/*`
- `ORCHESTRATOR.md`

- [ ] Añadir hook para `beforeinstallprompt` y detección de `standalone`.
- [ ] Pintar CTA de instalación solo cuando tenga sentido.
- [ ] Añadir fallback corto para iOS/Safari.
- [ ] Integrar el CTA en `Capture` y, si aporta, en navegación móvil.
- [ ] Verificar con:
  - `node --test --experimental-strip-types tests/components/pwa/install-prompt.test.mjs`
  - `npx eslint 'components/pwa/install-prompt.tsx' 'components/pwa/use-install-prompt.ts' 'app/(app)/capture/page.tsx' 'components/sidebar/mobile-menu.tsx' 'lib/i18n/messages.ts' 'tests/components/pwa/install-prompt.test.mjs'`

### Task 3: Ajustes de shell en modo standalone

**Subagente**
- tipo: `frontend-developer`
- modelo: `gpt-5.4-mini`
- razonamiento: `medium`
- skills: `react-19`, `tailwind-4`, `verification-before-completion`

**Files**
- Modify: `components/sidebar/mobile-menu.tsx`
- Modify: `app/(app)/capture/page.tsx`
- Modify: `app/(app)/capture/inbox/page.tsx`
- Modify: `components/capture/mobile-capture-uploader.tsx`
- Test: `tests/components/pwa/standalone-shell.test.mjs`

**Must not touch**
- `models/mobile/*`
- `app/api/*`
- `ORCHESTRATOR.md`

- [ ] Detectar `display-mode: standalone` y simplificar chrome redundante.
- [ ] Mantener prominentes `Captura` e `Inbox`.
- [ ] Evitar cambios de layout de escritorio.
- [ ] Verificar con:
  - `node --test --experimental-strip-types tests/components/pwa/standalone-shell.test.mjs`
  - `npx eslint 'components/sidebar/mobile-menu.tsx' 'app/(app)/capture/page.tsx' 'app/(app)/capture/inbox/page.tsx' 'components/capture/mobile-capture-uploader.tsx' 'tests/components/pwa/standalone-shell.test.mjs'`

### Task 4: Validación manual PWA

**Subagente**
- tipo: `browser-debugger`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `verification-before-completion`

**Files**
- No code changes

**Must not touch**
- todo el código del repo

- [ ] Validar install prompt en móvil/standalone cuando aplique.
- [ ] Validar `start_url` y acceso a `Captura`.
- [ ] Validar acceso directo a `Inbox móvil` desde shortcut o desde la shell instalada.
- [ ] Recoger evidencias y síntomas residuales.

## Orden recomendado

1. `Task 1`
2. `Task 2`
3. `Task 3`
4. `Task 4`

## Verificación integrada final

```bash
node --test --experimental-strip-types tests/app/pwa/manifest.test.mjs tests/components/pwa/install-prompt.test.mjs tests/components/pwa/standalone-shell.test.mjs
npx eslint 'public/site.webmanifest' 'app/layout.tsx' 'app/(app)/layout.tsx' 'components/pwa/install-prompt.tsx' 'components/pwa/use-install-prompt.ts' 'app/(app)/capture/page.tsx' 'app/(app)/capture/inbox/page.tsx' 'components/sidebar/mobile-menu.tsx' 'components/capture/mobile-capture-uploader.tsx' 'lib/i18n/messages.ts'
npx tsc --noEmit --pretty false
npm run build
```

## Criterio de cierre

- manifest instalable y con identidad de producto
- CTA de instalación visible solo cuando toca
- `start_url` orientado a `Captura`
- shell en `standalone` más limpia que la web normal
- tests, tipos y build en verde
