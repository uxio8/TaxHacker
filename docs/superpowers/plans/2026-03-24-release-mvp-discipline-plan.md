# Release MVP Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hacer que cada release de TaxHacker sea trazable, comprobable y desplegable por SHA sin montar una plataforma de release sobredimensionada.

**Architecture:** este frente no introduce CD completa ni staging formal. Reutiliza los workflows Docker ya existentes, añade un contrato mínimo de release observable (`SHA -> imagen -> instancia`) y separa la validación en dos niveles: PR rápida obligatoria y verificación post-deploy ligera.

**Tech Stack:** GitHub Actions, GHCR, Next.js 15 App Router, TypeScript, `node:test`, Playwright, shell scripts ligeros.

---

## Thesis

- `release mvp first`
- `single artifact by sha`
- `fast pr verification`
- `manual deploy by sha`
- `post-deploy check before more automation`

## Scope

Este plan cubre:
- tags Docker por SHA
- metadata de release visible por endpoint
- workflow rápido de PR
- runbook de deploy manual por SHA
- check post-deploy mínimo

Este plan no cubre:
- deploy automático
- staging formal
- rollback automatizado
- Playwright pesado como gate obligatorio en PR
- rediseño visual

## Current Gaps

1. Los workflows de [docker-latest.yml](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/.github/workflows/docker-latest.yml) y [docker-release.yml](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/.github/workflows/docker-release.yml) publican imágenes pero no exponen un tag inmutable por commit.
2. La app expone `version` desde [lib/config.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/lib/config.ts), pero no muestra ni sirve de forma simple el `build sha` desplegado.
3. No existe workflow de PR con validación rápida obligatoria.
4. El deploy real de [tax.agentworklab.com](https://tax.agentworklab.com) no está codificado en el repo y no hay runbook corto por SHA.
5. No existe comprobación post-deploy estándar y repetible.

## Success Criteria

El frente queda cerrado cuando:
- una imagen GHCR se publica con `latest` y con un tag por SHA
- existe un endpoint simple que devuelve `version`, `buildSha` y `environment`
- una PR nueva puede ejecutar un workflow rápido con `lint`, `tsc` y suites Node críticas
- el repo contiene un runbook corto para desplegar una SHA concreta
- existe un comando o script para comprobar `200` + `buildSha` tras el deploy

## Global Delivery Rules

- Orquestación:
  - [$subagent-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/subagent-driven-development/SKILL.md)
  - [$requesting-code-review](/Users/uxiomarcosmacmini/.codex/superpowers/skills/requesting-code-review/SKILL.md)
- Skills obligatorias en implementación:
  - [$test-driven-development](/Users/uxiomarcosmacmini/.codex/superpowers/skills/test-driven-development/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)
- Skills por tipo de tarea:
  - GitHub Actions / pipelines:
    - [$systematic-debugging](/Users/uxiomarcosmacmini/.codex/superpowers/skills/systematic-debugging/SKILL.md)
  - App Router / routes:
    - [$nextjs-15](/Users/uxiomarcosmacmini/.agents/skills/nextjs-15/SKILL.md)
  - React mínimo si se añade visibilidad en UI:
    - [$react-19](/Users/uxiomarcosmacmini/.agents/skills/react-19/SKILL.md)
  - Smokes / checks remotos:
    - [$playwright](/Users/uxiomarcosmacmini/.agents/skills/playwright/SKILL.md)

## Subagent Pool

| Rol | Uso principal | Modelo | Razonamiento |
|---|---|---|---|
| `devops-engineer` | workflows GHCR y CI de PR | `gpt-5.4` | `high` |
| `nextjs-developer` | endpoint de metadata de release | `gpt-5.4` | `medium` |
| `tooling-engineer` | script/check post-deploy y scripts npm | `gpt-5.4-mini` | `medium` |
| `qa-expert` | tests de workflow, contrato y check final | `gpt-5.4` | `high` |
| `reviewer` | revisión final del diff y del runbook | `gpt-5.4` | `high` |

## Parallelization Rules

Pueden ir en paralelo al principio:
- `Task 1` tags Docker por SHA
- `Task 2` endpoint de release

No ejecutar en paralelo:
- `Task 3` y `Task 4` si ambos pisan el mismo tramo de `package.json`
- `Task 5` antes de cerrar `Task 1`, `Task 2` y `Task 4`

## Task 1: Publicar imágenes GHCR con tag por SHA

**Subagente**
- tipo: `devops-engineer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Modify: [docker-latest.yml](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/.github/workflows/docker-latest.yml)
- Modify: [docker-release.yml](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/.github/workflows/docker-release.yml)
- Create: [tests/critical/workflows-release.test.mjs](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tests/critical/workflows-release.test.mjs)

**Must not touch**
- `app/*`
- `components/*`
- `models/*`

- [ ] Escribir test de contrato de workflows:
  - `docker-latest` publica `latest` y `sha-...`
  - `docker-release` publica semver y `sha-...`
- [ ] Modificar `docker-latest.yml` para añadir tag por SHA sin quitar `latest`.
- [ ] Modificar `docker-release.yml` para añadir tag por SHA sin quitar semver.
- [ ] Añadir labels OCI mínimos:
  - `org.opencontainers.image.revision`
  - `org.opencontainers.image.source`
- [ ] Ejecutar el test de contrato del workflow.

## Task 2: Exponer metadata de release en un endpoint estable

**Subagente**
- tipo: `nextjs-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills:
  - [$nextjs-15](/Users/uxiomarcosmacmini/.agents/skills/nextjs-15/SKILL.md)
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)

**Files**
- Modify: [lib/config.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/lib/config.ts)
- Create: [app/api/health/route.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/app/api/health/route.ts)
- Create: [tests/app/api/health-route.test.mjs](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tests/app/api/health-route.test.mjs)

**Must not touch**
- fiscal
- `components/*`
- `playwright.config.ts`

- [ ] Escribir test del endpoint:
  - devuelve `200`
  - incluye `version`
  - incluye `buildSha`
  - incluye `environment` si existe
- [ ] Extender `createConfig()` para aceptar `APP_BUILD_SHA` y `APP_ENVIRONMENT`.
- [ ] Crear `GET /api/health` con payload JSON mínimo y estable.
- [ ] Verificar que sin variables nuevas sigue funcionando con defaults explícitos.

## Task 3: Añadir CI rápida y obligatoria para PR

**Subagente**
- tipo: `devops-engineer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)
  - [$systematic-debugging](/Users/uxiomarcosmacmini/.codex/superpowers/skills/systematic-debugging/SKILL.md)

**Files**
- Modify: [package.json](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/package.json)
- Create: [tests/critical/run-critical-fast.mjs](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tests/critical/run-critical-fast.mjs)
- Create: [pr-verify.yml](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/.github/workflows/pr-verify.yml)
- Create: [tests/critical/pr-verify-workflow.test.mjs](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tests/critical/pr-verify-workflow.test.mjs)

**Must not touch**
- flujos Docker de release ya cerrados en `Task 1`
- Playwright specs

- [ ] Añadir variante rápida separada del harness crítico:
  - mismo `typegen`
  - mismo `tsc`
  - mismas suites Node críticas
  - sin bloque Playwright
  - sin tocar el contrato actual de `verify:critical`
- [ ] Exponer `npm run verify:critical:fast`.
- [ ] Escribir test de contrato del workflow `pr-verify`.
- [ ] Crear workflow de PR con:
  - checkout
  - install
  - `npm run lint`
  - `npm run verify:critical:fast`
- [ ] Documentar que este workflow será el check obligatorio de PR.

## Task 4: Añadir comprobación post-deploy mínima por SHA

**Subagente**
- tipo: `tooling-engineer`
- modelo: `gpt-5.4-mini`
- razonamiento: `medium`
- skills:
  - [$typescript](/Users/uxiomarcosmacmini/.agents/skills/typescript/SKILL.md)

**Files**
- Create: [scripts/check-release-health.ts](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/scripts/check-release-health.ts)
- Create: [tests/scripts/check-release-health.test.mjs](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/tests/scripts/check-release-health.test.mjs)
- Modify: [package.json](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/package.json)

**Must not touch**
- `app/*` salvo el endpoint ya creado
- workflows Docker

- [ ] Escribir test del script:
  - falla si no hay `200`
  - falla si `buildSha` no coincide
  - pasa si `buildSha` coincide
- [ ] Implementar script que reciba:
  - `--url`
  - `--sha`
- [ ] Añadir script npm, por ejemplo:
  - `release:check`
- [ ] Verificarlo contra una respuesta mockeada/testeada.

## Task 5: Runbook de deploy manual por SHA

**Subagente**
- tipo: `project-manager`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills:
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Create: [docs/superpowers/specs/2026-03-24-release-mvp-runbook.md](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/docs/superpowers/specs/2026-03-24-release-mvp-runbook.md)
- Modify: [ORCHESTRATOR.md](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/ORCHESTRATOR.md)

**Must not touch**
- dominio
- componentes
- read APIs

- [ ] Documentar el flujo manual:
  - elegir SHA
  - resolver tag GHCR
  - inyectar `APP_BUILD_SHA=$SHA` en el runtime real
  - fijar `APP_ENVIRONMENT` solo si aporta señal operativa real
  - desplegar esa imagen en el entorno real
  - comprobar `GET /api/health`
  - comparar `buildSha`
- [ ] Añadir mini-runbook de rollback:
  - redeploy de la SHA anterior
- [ ] Anotar en `ORCHESTRATOR.md` que el siguiente objetivo operativo es `release MVP`.

## Task 6: Cierre y revisión final

**Subagente**
- tipo: `reviewer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills:
  - [$requesting-code-review](/Users/uxiomarcosmacmini/.codex/superpowers/skills/requesting-code-review/SKILL.md)
  - [$verification-before-completion](/Users/uxiomarcosmacmini/.codex/superpowers/skills/verification-before-completion/SKILL.md)

**Files**
- Review only: diff completo del frente

- [ ] Reejecutar:
  - `npm run lint`
  - `./node_modules/.bin/tsc --noEmit --pretty false`
  - `node --test --experimental-strip-types tests/critical/workflows-release.test.mjs tests/app/api/health-route.test.mjs tests/critical/pr-verify-workflow.test.mjs tests/scripts/check-release-health.test.mjs`
- [ ] Confirmar que no se ha metido:
  - deploy automático
  - staging
  - Playwright pesado en PR
  - cambios funcionales de producto
- [ ] Abrir PR con resumen:
  - release metadata
  - fast PR CI
  - manual deploy by SHA
  - post-deploy check

## Recommended Execution Order

1. en paralelo:
   - `Task 1`
   - `Task 2`
2. `Task 3`
3. `Task 4`
4. `Task 5`
5. `Task 6`

## Deferred On Purpose

No hacer en este frente:
- workflow de deploy automático
- promoción entre entornos
- staging formal
- rollback automático
- Playwright crítico como gate duro de PR

La condición para abrir ese siguiente frente es simple:
- que `release mvp` se use durante varios cambios reales sin fricción operativa nueva.
