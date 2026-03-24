# Contrato de `read API` de workflow

Fecha: 2026-03-23  
Estado: draft inicial de `Phase 0`

## Objetivo

Separar la UI de la implementación interna del workflow.

## Funciones estables iniciales

- `getPeriodClosurePosture()`
- `listTopWorkflowItems()`
- `getWorkflowReadinessSummary()`
- `getWorkflowDocumentInbox()`
- `getWorkflowFiscalCockpit()`
- `getWorkflowTransactionExceptions()`

## Regla principal

Las pantallas consumen esta capa. No leen projectors internos ni recomponen semántica de workflow por su cuenta.

## Estrategia inicial

- implementación con projectors puros
- lectura sobre tablas actuales
- flags por superficie
- paridad legacy vs nueva antes de cleanup

## Endurecimiento posterior

Solo cuando lo pidan métricas y operación:
- `WorkItem` materializado
- `DomainEvent`
- `WorkflowJob`
