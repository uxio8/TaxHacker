# Contrato del expediente de presentación

Fecha: 2026-03-23  
Estado: congelado para implementación

## 1. Objetivo

Definir qué significa que una obligación esté `lista para presentar` o `presentada` dentro de TaxHacker.

## 2. Expediente mínimo

Cada obligación debe poder guardar un expediente mínimo con:

- `draftSnapshot`
- `traceSummary`
- `evidenceManifest`
- `checklistState`
- `filingReference`
- `filingReceiptFileId`
- `filedAt`
- `filedByUserId`
- `filingNotes`

## 3. Semántica

- `draftSnapshot`
  - foto reproducible del borrador que se pretende presentar

- `traceSummary`
  - resumen de totales, fuentes y huecos relevantes

- `evidenceManifest`
  - lista explícita de evidencias adjuntas o exigidas

- `checklistState`
  - pasos mínimos marcados para declarar la obligación como lista

- `filingReference`
  - CSV, NRC, código de presentación o referencia equivalente

- `filingReceiptFileId`
  - adjunto con justificante, acuse o soporte de presentación

## 4. Modos de presentación

### 4.1 Presentado dentro de la app

Si en el futuro se integra la presentación real:

- la app podrá mover de `ready_to_file` a `filed`
- deberá dejar referencia y justificante

### 4.2 Presentado fuera y archivado en la app

Modo soportado desde V1:

- el usuario presenta fuera
- TaxHacker registra:
  - referencia
  - fecha
  - quién presentó
  - justificante
  - notas

## 5. Requisitos para `ready_to_file`

Una obligación solo puede declararse `ready_to_file` si:

- tiene borrador
- no tiene bloqueos materiales
- tiene checklist mínimo completo
- tiene evidencias mínimas cubiertas

## 6. Requisitos para `filed`

Una obligación solo puede declararse `filed` si:

- tiene `filingReference` o justificante equivalente
- queda auditado quién y cuándo la marcó

## 7. División asesoría-cliente

Responsabilidades típicas:

- cliente:
  - subir documentación
  - responder incidencias
  - aportar evidencias externas

- asesoría:
  - validar
  - preparar borrador
  - marcar lista para presentar
  - presentar o registrar la presentación

