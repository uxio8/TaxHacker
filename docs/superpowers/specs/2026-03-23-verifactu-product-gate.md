# Gate de producto para VERI*FACTU

Fecha: 2026-03-23  
Estado: congelado para roadmap  
Ambito: decision de producto y dependencias previas antes de meter VERI*FACTU en el core

## 1. Decision cerrada

VERI*FACTU queda `fuera del core fiscal trimestral` mientras TaxHacker no se comercialice ni se use como sistema de emision oficial de facturas.

En el estado actual del repo:

- `app/(app)/apps/invoices/page.tsx` monta una miniapp de generacion
- `app/(app)/apps/invoices/components/invoice-generator.tsx` ofrece:
  - preview/PDF
  - `Download PDF`
  - `Save as Transaction`
- `app/(app)/apps/invoices/actions.ts` persiste una `Transaction` y un PDF adjunto, pero no crea un recurso inmutable de factura emitida ni una cadena de cumplimiento

Por tanto:

- hoy la miniapp de facturas se considera `draft authoring`
- no se considera `emision conforme`
- y no debe condicionar el roadmap de `303`, `115`, revision fiscal, expediente ni archivo

## 2. Cuando se abre el gate

VERI*FACTU pasa a prioridad alta solo si se cumple al menos una de estas condiciones:

- el producto vende TaxHacker como sistema de facturacion para emitir facturas a clientes
- la miniapp `invoices` deja de ser borrador/PDF y pasa a tener accion real de `Emitir factura`
- se promete a clientes que el documento generado sirve como factura emitida conforme

Si ninguna se cumple, VERI*FACTU sigue en track separado.

## 3. Precondiciones para implementarlo

Antes de meter VERI*FACTU en codigo de producto deben estar cerradas estas dependencias:

- separar `borrador` de `emision`
- introducir un recurso canonico de `IssuedInvoice`
- snapshot inmutable del emisor, cliente, lineas e impuestos
- numeracion/serie con contrato explicito
- hash de documento y enlace al anterior
- QR y eventos append-only
- proyeccion explicita hacia `Transaction` y `TransactionFiscal`
- politica de rectificacion y estados de cumplimiento

## 4. Lo que no se permite mientras el gate este cerrado

- no vender `Download PDF` como salida conforme
- no vender `Save as Transaction` como emision legal
- no acoplar el cierre trimestral a una cadena de facturacion aun inexistente
- no introducir requisitos VERI*FACTU en `303`, `115`, `390`, `180`, `347` o `349`

## 5. Fuentes externas que justifican el gate

- AEAT `Sistemas Informaticos de Facturacion - VERI*FACTU`:
  - https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html
- Real Decreto 1007/2023:
  - https://www.boe.es/eli/es/rd/2023/12/05/1007

Lectura de producto:

- el impacto regulatorio existe y es relevante
- pero solo entra en el camino critico cuando TaxHacker asume el rol de sistema de emision
- hasta entonces, el camino correcto es proteger el core fiscal trimestral y mantener este frente separado

## 6. Decision operativa para roadmap

Orden aprobado:

1. cerrar torre de control fiscal trimestral
2. cerrar handoff anual ligero
3. evaluar si la miniapp `invoices` pasa a ser producto de emision
4. solo entonces abrir el cambio VERI*FACTU
