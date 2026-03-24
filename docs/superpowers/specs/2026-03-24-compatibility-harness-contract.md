# Compatibility Harness Contract

Fecha: 2026-03-24
Estado: activo para la Task 0.1

## Objetivo

Congelar un `compatibility harness` mínimo antes del refactor para detectar deriva incompatible sin tocar producto. El harness debe reutilizar checks ya existentes y ejecutarse con un único comando: `verify:critical`.

## Superficies críticas

| Superficie | Cobertura mínima | Señal de rollback |
| --- | --- | --- |
| `dashboard` | `node:test` de wiring documental y atención | `WORKFLOW_DOCUMENT_SLICE=0` |
| `unsorted` | `node:test` de wiring documental y guidance del análisis | `WORKFLOW_DOCUMENT_SLICE=0` |
| `capture` | `node:test` de rutas y acciones de review | `WORKFLOW_DOCUMENT_SLICE=0` |
| `tax` | `node:test` de wiring fiscal y cola de revisión + smoke Playwright de obligaciones/colaboración | `WORKFLOW_FISCAL_SLICE=0` |
| `archive` | `node:test` de wiring fiscal y archivo legal + smoke Playwright anual | `WORKFLOW_FISCAL_SLICE=0` |
| `transactions` | `node:test` de wiring estable y panel fiscal + smoke Playwright de resolución de contraparte | `WORKFLOW_TRANSACTIONS_SLICE=0` |
| `ops` | `node:test` de dashboard y detalle por organización | `none` |

## Thresholds de drift

El refactor solo puede avanzar si el harness queda en verde con estos límites:

```txt
typeErrors: 0
nodeSuiteFailures: 0
playwrightFailures: 0
uncoveredCriticalSurfaces: 0
```

Interpretación operativa:

- `typeErrors: 0`: no se acepta deriva de tipos en el árbol actual.
- `nodeSuiteFailures: 0`: ninguna suite contractual crítica puede fallar.
- `playwrightFailures: 0`: ningún smoke crítico puede degradarse.
- `uncoveredCriticalSurfaces: 0`: ninguna de las siete superficies puede quedarse sin al menos una suite automatizada activa.

## Composición mínima del harness

`verify:critical` debe ejecutar, en este orden:

1. `npx tsc --noEmit --pretty false`
2. suites `node:test` críticas agregadas desde `tests/critical/surfaces.mjs`
3. smokes Playwright críticos ya existentes en `tests/e2e`

No se añade infraestructura nueva ni runners pesados. El harness solo compone comandos existentes y falla rápido en el primer drift confirmado.

## Uso desde worktrees o entornos sin runtime local

Si el runtime local no está disponible pero existe una instancia ya accesible, el harness puede reutilizarla fijando `PLAYWRIGHT_BASE_URL` a una URL externa. En ese caso, `playwright.config.ts` no debe intentar levantar `npm run local:start`.

Ejemplo:

```bash
PLAYWRIGHT_BASE_URL=https://tax.agentworklab.com npm run verify:critical
```

Este modo sirve para validar el harness en worktrees aislados o máquinas sin Docker operativo. No sustituye la validación local cuando el slice que se está tocando exige comprobar código aún no desplegado.

Importante: los smokes Playwright actuales siembran datos con Prisma antes de navegar. Por tanto, una `PLAYWRIGHT_BASE_URL` externa solo es válida si `DATABASE_URL` apunta a una base de datos accesible y coherente con esa instancia objetivo. El harness hidrata su entorno desde `.env`, `.env.localdeploy` y `.env.tunnel` si existen en la raíz del workspace, pero las variables explícitas del shell siempre mandan.

## Rollback simple por flag

Si una iteración del refactor rompe compatibilidad en superficies documentales o fiscales, el rollback operativo inmediato consiste en apagar los flags de slice y redeployar:

```bash
WORKFLOW_DOCUMENT_SLICE=0
WORKFLOW_FISCAL_SLICE=0
WORKFLOW_TRANSACTIONS_SLICE=0
```

Lectura del contrato:

- `dashboard`, `unsorted` y `capture` vuelven al camino legacy con `WORKFLOW_DOCUMENT_SLICE=0`.
- `tax` y `archive` vuelven al camino legacy con `WORKFLOW_FISCAL_SLICE=0`.
- `transactions` vuelve al camino legacy con `WORKFLOW_TRANSACTIONS_SLICE=0`.
- `ops` queda fuera del rollback por flag en esta fase; cualquier cambio futuro sobre `ops` debe llegar con su propia cobertura y, si amplía blast radius, con su propio flag.
