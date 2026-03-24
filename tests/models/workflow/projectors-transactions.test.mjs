import assert from "node:assert/strict"
import test from "node:test"

const workflowContractsModule = await import(new URL("../../../models/workflow/contracts.ts", import.meta.url))
const transactionsProjectorModule = await import(
  new URL("../../../models/workflow/projectors/transactions.ts", import.meta.url)
)

test("buildTransactionWorkflowItems agrega señales por transacción sin perder materialidad", () => {
  const items = transactionsProjectorModule.buildTransactionWorkflowItems([
    {
      id: "tx-1",
      title: "Compra Amazon",
      href: "/transactions/tx-1",
      signals: [
        {
          code: "missing_category",
          label: "Sin categoría",
          description: "Asigna categoría",
          href: "#transaction-edit",
        },
      ],
    },
    {
      id: "tx-2",
      title: "Factura proveedor",
      href: "/transactions/tx-2",
      signals: [
        {
          code: "pending_fiscal",
          label: "Pendiente fiscal",
          description: "Falta revisión fiscal",
          href: "#transaction-fiscal",
        },
      ],
    },
  ])

  const normal = items.find((item) => item.id === "transaction:tx-1")
  assert.equal(normal?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.NEEDS_ACTION)
  assert.equal(normal?.materiality, workflowContractsModule.WORKFLOW_MATERIALITY.MEDIUM)

  const fiscal = items.find((item) => item.id === "transaction:tx-2")
  assert.equal(fiscal?.materiality, workflowContractsModule.WORKFLOW_MATERIALITY.HIGH)
  assert.equal(fiscal?.blockingReason, "pending_fiscal")
  assert.equal(fiscal?.recommendedSurface, workflowContractsModule.WORKFLOW_SURFACE.TRANSACTIONS)
})
