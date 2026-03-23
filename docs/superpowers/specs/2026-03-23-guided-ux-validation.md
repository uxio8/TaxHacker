# Guided UX Validation

## Flujos a validar
1. `setup`
   - tenant sin IA o sin perfil fiscal
   - dashboard y settings muestran checklist y CTA único
2. `operación diaria`
   - tenant listo
   - dashboard muestra centro de atención y siguiente paso
3. `unsorted`
   - documento sin borrador -> `Analizar con IA`
   - documento con borrador -> detalle abierto y revisión rápida
   - documento derivado desde móvil -> handoff visible en dashboard y `unsorted`
4. `transactions`
   - quick views reales en URL
   - señales ligeras de excepción en lista y detalle
5. `tax`
   - trimestre activo, siguiente acción y bloqueos visibles
6. `capture`
   - copy humano de escalado a escritorio y siguiente paso recomendado
7. `sidebar`
   - setup pendiente o top item visible sin cambiar la estética base

## Evidencia mínima
- tests dirigidos del write set
- `npx tsc --noEmit --pretty false`
- `npm run build`
- smoke manual en:
  - dashboard
  - unsorted
  - transactions
  - tax
  - capture / capture inbox / capture review

## Validación ejecutada el 23 de marzo de 2026
- `dashboard`
  - checklist de `setup`, centro de atención y handoff móvil visibles
- `unsorted`
  - alerta de derivación desde móvil, CTA principal y progressive disclosure visibles
- `transactions?quickView=incomplete`
  - quick views activos y resumen de filtros visible
- `tax`
  - siguiente acción fiscal, trimestre activo y módulos secundarios visibles
- `capture`
  - hero de captura y CTAs principales visibles
- `capture/inbox`
  - copy humano de escalado y siguiente paso recomendado visibles
- `capture/review/[fileId]`
  - alerta de siguiente paso, labels humanos y CTA de continuidad visibles
