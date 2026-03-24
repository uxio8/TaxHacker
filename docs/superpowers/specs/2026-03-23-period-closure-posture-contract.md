# Contrato de postura de cierre del periodo

Fecha: 2026-03-23  
Estado: draft inicial de `Phase 0`

## Objetivo

Dar una señal única y estable del estado operativo del periodo activo.

## Posturas

- `blocked`
- `at_risk`
- `on_track`
- `defendible`
- `filed`
- `archived`

## Orden de prioridad

1. `archived`
2. `blocked`
3. `at_risk`
4. `filed`
5. `defendible`
6. `on_track`

## Señales mínimas

- bloqueos abiertos
- trabajo pendiente
- expediente listo para presentar
- obligación presentada
- archivo final cerrado

## Regla de lectura

La postura se consume desde una `read API` estable. La UI no recalcula la postura por su cuenta.
