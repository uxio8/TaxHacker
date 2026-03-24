# Attention Priority Contract

## Orden estable
1. setup bloqueante
2. bloqueos fiscales
3. revisión documental en `unsorted`
4. handoff desde móvil a escritorio
5. excepciones del libro operativo
6. cola fiscal no bloqueante

## Reglas de prioridad
- `critical`
  - setup bloqueante
  - documentos fiscales bloqueados
- `high`
  - documentos pendientes en `unsorted`
  - handoff móvil -> escritorio
- `medium`
  - excepciones de transacciones
  - revisión fiscal no bloqueante
- `low`
  - reservada para futuras señales informativas sin bloqueo

## Semántica de CTA
- setup -> `settings`
- revisión documental -> `unsorted`
- handoff móvil -> `unsorted`
- libro operativo -> `transactions` con `quickView`
- fiscal -> `tax`
