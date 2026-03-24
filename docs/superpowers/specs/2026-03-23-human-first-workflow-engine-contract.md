# Contrato del workflow `human-first`

Fecha: 2026-03-23  
Estado: draft inicial de `Phase 0`

## Objetivo

Unificar la semántica operativa de TaxHacker para que todas las superficies hablen el mismo idioma antes de introducir persistencia adicional o automatización más compleja.

## Cadena canónica

1. `document_evidence`
2. `operational_record`
3. `fiscal_obligation`
4. `filing_dossier`
5. `archive_manifest`

## Campos transversales

- `status`
- `owner`
- `dueAt`
- `materiality`
- `confidence`
- `blockingReason`
- `nextAction`
- `recommendedSurface`

## Regla principal

`WorkItem` nace primero como interfaz semántica y proyección lógica. No obliga a crear todavía una tabla nueva.

## Fuente de verdad

La verdad sigue en el dominio actual:
- `File`
- `AnalysisJob`
- `Transaction`
- `FiscalObligation`
- `FiscalFilingDossier`
- `LegalArchive`

## Límites de esta fase

- sin `DomainEvent` persistido
- sin `WorkflowJob` genérico
- sin UX de cartera
- sin agentes
