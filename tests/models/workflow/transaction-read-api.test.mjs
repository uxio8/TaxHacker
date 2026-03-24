import assert from "node:assert/strict"
import test from "node:test"

import {
  getTransactionWorkflowDetailView,
  getTransactionsWorkflowView,
} from "../../../models/workflow/transaction-read-api.ts"

test("getTransactionsWorkflowView unifica libro, señales de excepción y workflow estable", async () => {
  const fields = [
    {
      id: "field_category",
      name: "Categoría",
      code: "categoryCode",
      isVisibleInList: true,
    },
  ]
  const transactions = [
    {
      id: "tx_1",
      name: "Amazon",
      files: [],
    },
    {
      id: "tx_2",
      name: "Proveedor fiscal",
      files: [],
    },
  ]
  const result = await getTransactionsWorkflowView(
    {
      organizationId: "org_1",
      filters: {
        quickView: "pending_fiscal",
      },
      page: 2,
      perPage: 500,
    },
    {
      getCategories: async () => [{ code: "ops", name: "Operaciones" }],
      getProjects: async () => [{ code: "p1", name: "Proyecto 1" }],
      getFields: async () => fields,
      getTransactions: async () => ({
        transactions,
        total: 2,
      }),
      getTransactionAttentionSignals: (transaction) =>
        transaction.id === "tx_1"
          ? [
              {
                code: "missing_category",
                label: "Sin categoría",
                description: "Falta clasificar el movimiento.",
                href: "#transaction-edit",
              },
            ]
          : [
              {
                code: "pending_fiscal",
                label: "Pendiente fiscal",
                description: "Falta revisión fiscal.",
                href: "#transaction-fiscal",
              },
            ],
    }
  )

  assert.equal(result.categories.length, 1)
  assert.equal(result.projects.length, 1)
  assert.equal(result.fields.length, 1)
  assert.equal(result.transactions.length, 2)
  assert.equal(result.total, 2)
  assert.equal(result.workflow.items.length, 2)
  assert.equal(result.workflow.topItem?.id, "transaction:tx_2")
  assert.equal(result.attentionByTransactionId.tx_1[0].code, "missing_category")
  assert.equal(result.attentionByTransactionId.tx_2[0].code, "pending_fiscal")
})

test("getTransactionWorkflowDetailView unifica detalle, señales y panel fiscal bajo la misma semántica", async () => {
  const transaction = {
    id: "tx_detail_1",
    name: "Proveedor oficina",
    files: [],
    fiscalDocument: null,
  }
  const fields = [
    {
      id: "field_category",
      code: "categoryCode",
      name: "Categoría",
      options: null,
      type: "text",
      userId: "user_1",
      organizationId: "org_1",
      createdAt: new Date("2026-03-23T10:00:00.000Z"),
      llm_prompt: null,
      isVisibleInList: true,
      isVisibleInAnalysis: true,
      isRequired: false,
      isExtra: false,
    },
  ]

  const result = await getTransactionWorkflowDetailView(
    {
      organizationId: "org_1",
      transactionId: "tx_detail_1",
      userId: "user_1",
    },
    {
      getTransactionById: async () => transaction,
      getFilesByTransactionId: async () => [],
      getCategories: async () => [],
      getCurrencies: async () => [],
      getSettings: async () => ({ separators: { decimal: ",", thousands: "." } }),
      getFields: async () => fields,
      getProjects: async () => [],
      getFiscalProfileAccessByOrganizationId: async () => ({ status: "profile_missing" }),
      incompleteTransactionFields: () => [],
      getTransactionAttentionSignals: () => [
        {
          code: "pending_fiscal",
          label: "Pendiente fiscal",
          description: "Falta revisión fiscal.",
          href: "#transaction-fiscal",
        },
      ],
    }
  )

  assert.equal(result.transaction.id, "tx_detail_1")
  assert.equal(result.fields.length, 1)
  assert.equal(result.incompleteFields.length, 0)
  assert.equal(result.attentionSignals[0].code, "pending_fiscal")
  assert.equal(result.fiscalPanel.profileStatus, "profile_missing")
  assert.equal(result.fiscalPanel.document, null)
  assert.deepEqual(result.fiscalPanel.periodOptions, [])
})
