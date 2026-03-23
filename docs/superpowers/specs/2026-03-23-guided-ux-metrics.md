# Guided UX Metrics

## Métricas mínimas
- `captura -> registrado`
  - tiempo desde que entra un documento hasta que se guarda como transacción
- `backlog de revisión`
  - total de documentos en `unsorted`
- `bloqueos fiscales`
  - documentos bloqueados en la cola fiscal
- `derivación a escritorio`
  - documentos con `mobileTriage.disposition = deferred`
- `excepciones del libro`
  - transacciones incompletas o con revisión fiscal pendiente

## Dónde leerlas hoy
- `models/attention.ts`
  - resumen transversal de atención
- `models/unsorted-inbox.ts`
  - estado documental y handoff móvil-escritorio
- `models/transactions.ts`
  - quick views y excepciones operativas
- `models/tax-attention.ts`
  - trimestre activo, bloqueos y revisión fiscal

## Criterio práctico
- si baja el backlog de `unsorted` y sube la tasa de resolución desde móvil o inbox sin abrir más pantallas, el guiado está funcionando
