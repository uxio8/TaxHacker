# Contrato operativo de obligaciones fiscales recurrentes

Fecha: 2026-03-23  
Estado: congelado para implementación  
Ámbito: producto fiscal para S.L. española estándar en TaxHacker

## 1. Objetivo

Definir el workflow canónico de una obligación fiscal recurrente dentro de TaxHacker para que `303`, `115`, `111 manual`, `180`, `390`, `347`, `349` y el handoff anual compartan el mismo lenguaje operativo.

## 2. Unidad de producto

La unidad operativa no es una pantalla ni un modelo suelto.  
La unidad operativa es la `obligación fiscal`.

Cada obligación debe poder responder siempre a estas preguntas:

- qué periodo cubre
- si aplica o no aplica
- qué falta para dejarla lista
- quién tiene que actuar
- con qué evidencias se sostiene
- si ya está preparada
- si ya está presentada
- dónde está el justificante

## 3. Estados canónicos

Estados permitidos:

- `not_applicable`
- `waiting_on_documents`
- `needs_review`
- `ready_to_prepare`
- `draft_ready`
- `ready_to_file`
- `filed`
- `archived`

### 3.1 Semántica exacta

- `not_applicable`
  - la obligación no aplica al tenant o al periodo
  - no debe ensuciar el cockpit principal

- `waiting_on_documents`
  - la obligación aplica, pero todavía faltan documentos, datos o evidencias mínimas

- `needs_review`
  - hay material suficiente para trabajar, pero persisten incidencias fiscales que bloquean preparación o presentación

- `ready_to_prepare`
  - ya no faltan piezas críticas y se puede construir el borrador operativo

- `draft_ready`
  - el borrador existe y es coherente, pero todavía no está marcado como listo para presentar

- `ready_to_file`
  - la obligación tiene borrador, checklist y evidencias suficientes para presentar

- `filed`
  - ya se ha presentado o se ha registrado formalmente como presentada
  - exige referencia externa o justificante

- `archived`
  - la obligación ya quedó cerrada y archivada dentro del expediente anual o trimestral

## 4. Campos operativos obligatorios

Cada obligación debe exponer como mínimo:

- `code`
- `label`
- `periodKey`
- `fiscalYear`
- `quarter`
- `dueDate`
- `status`
- `owner`
- `blockingReasons`
- `requiredEvidence`
- `filingReference`
- `filedAt`
- `filedBy`
- `notes`

## 5. Responsable operativo

Valores canónicos de `owner`:

- `client`
- `advisor`
- `shared`
- `system`

Semántica:

- `client`: falta una acción documental o confirmación del cliente
- `advisor`: la pelota está en la asesoría
- `shared`: hay que coordinar ambos lados
- `system`: el siguiente paso es interno del producto

## 6. Bloqueos y evidencias

`blockingReasons` y `requiredEvidence` deben representarse como listas explícitas, nunca como texto libre único.

Ejemplos de bloqueos:

- `missing_counterparty_tax_id`
- `missing_vat_breakdown`
- `missing_rent_withholding_support`
- `missing_external_summary`
- `manual_confirmation_required`
- `filing_reference_missing`

Ejemplos de evidencia requerida:

- `source_documents`
- `counterparty_tax_id`
- `rent_contract`
- `external_payroll_summary`
- `draft_export`
- `filing_receipt`

## 7. Reglas de progresión

- una obligación no puede pasar a `draft_ready` si persisten bloqueos materiales
- una obligación no puede pasar a `ready_to_file` sin checklist y evidencias mínimas
- una obligación no puede pasar a `filed` sin `filingReference` o justificante adjunto
- una obligación `filed` solo puede volver atrás con evento auditado

## 8. Aplicabilidad inicial por obligación

En V1:

- `303`: aplica siempre al ICP objetivo
- `115`: aplica si `hasRentWithholding = true`
- `111_manual`: aplica si hay empleados o retenciones profesionales
- `180`: aplica si `115` aplica
- `390`: aplica como capa anual ligada al track IVA
- `347`: aplica por defecto, pero puede quedar `not_applicable` si el tenant o el dato lo excluyen
- `349`: aplica solo si `hasIntraEuOperations = true`
- `200_handoff`: aplica siempre como handoff anual
- `202_handoff`: aplica siempre como handoff anual

## 9. Qué queda fuera

Queda fuera de este contrato:

- nómina
- Seguridad Social
- `190`
- contabilidad general
- automatización real de `200/202`
- cuentas anuales automatizadas

