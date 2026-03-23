import assert from "node:assert/strict"
import test from "node:test"

import {
  createFiscalReviewRequest,
  resolveFiscalReviewRequest,
} from "../../../models/fiscal/review-requests.ts"
import { getFiscalReviewQueue } from "../../../models/fiscal/review-queue.ts"

test("createFiscalReviewRequest persiste una incidencia fiscal abierta con ownership explícito", async () => {
  const calls = []

  const request = await createFiscalReviewRequest(
    {
      organizationId: "org_1",
      ownerScopeId: "profile_1",
      fiscalDocumentId: "fiscal_doc_1",
      createdByUserId: "user_advisor",
      actorType: "advisor",
      owner: "client",
      message: "Falta el contrato de alquiler firmado.",
      dueDate: "2026-04-15",
    },
    {
      fiscalReviewRequest: {
        create: async (args) => {
          calls.push(args)
          return {
            id: "request_1",
            organizationId: args.data.organizationId,
            ownerScopeId: args.data.ownerScopeId,
            fiscalDocumentId: args.data.fiscalDocumentId,
            createdByUserId: args.data.createdByUserId,
            actorType: args.data.actorType,
            owner: args.data.owner,
            message: args.data.message,
            dueDate: args.data.dueDate,
            status: "open",
            resolvedAt: null,
            resolvedByUserId: null,
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-03-23T10:00:00.000Z"),
          }
        },
        update: async () => {
          throw new Error("not implemented")
        },
        findMany: async () => [],
      },
    }
  )

  assert.equal(request.owner, "client")
  assert.equal(request.status, "open")
  assert.equal(request.message, "Falta el contrato de alquiler firmado.")
  assert.deepEqual(calls, [
    {
      data: {
        organizationId: "org_1",
        ownerScopeId: "profile_1",
        fiscalDocumentId: "fiscal_doc_1",
        createdByUserId: "user_advisor",
        actorType: "advisor",
        owner: "client",
        message: "Falta el contrato de alquiler firmado.",
        dueDate: new Date("2026-04-15T00:00:00.000Z"),
        status: "open",
      },
    },
  ])
})

test("createFiscalReviewRequest reutiliza una incidencia abierta idéntica para evitar duplicados", async () => {
  let createCalls = 0

  const request = await createFiscalReviewRequest(
    {
      organizationId: "org_1",
      ownerScopeId: "profile_1",
      fiscalDocumentId: "fiscal_doc_1",
      createdByUserId: "user_advisor",
      actorType: "advisor",
      owner: "client",
      message: "Falta el contrato de alquiler firmado.",
      dueDate: "2026-04-15",
    },
    {
      fiscalReviewRequest: {
        create: async () => {
          createCalls += 1
          throw new Error("No debería crear una incidencia duplicada")
        },
        update: async () => {
          throw new Error("not implemented")
        },
        findMany: async () => [
          {
            id: "request_existing",
            organizationId: "org_1",
            ownerScopeId: "profile_1",
            fiscalDocumentId: "fiscal_doc_1",
            createdByUserId: "user_advisor",
            actorType: "advisor",
            owner: "client",
            message: "Falta el contrato de alquiler firmado.",
            dueDate: new Date("2026-04-15T00:00:00.000Z"),
            status: "open",
            resolvedAt: null,
            resolvedByUserId: null,
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-03-23T10:00:00.000Z"),
          },
        ],
      },
    }
  )

  assert.equal(createCalls, 0)
  assert.equal(request.id, "request_existing")
  assert.equal(request.status, "open")
  assert.equal(request.message, "Falta el contrato de alquiler firmado.")
  assert.equal(request.dueDate, "2026-04-15")
})

test("resolveFiscalReviewRequest cierra la incidencia sin borrar el rastro", async () => {
  const calls = []

  const request = await resolveFiscalReviewRequest(
    {
      requestId: "request_1",
      resolvedByUserId: "user_client",
    },
    {
      fiscalReviewRequest: {
        create: async () => {
          throw new Error("not implemented")
        },
        update: async (args) => {
          calls.push(args)
          return {
            id: "request_1",
            organizationId: "org_1",
            ownerScopeId: "profile_1",
            fiscalDocumentId: "fiscal_doc_1",
            createdByUserId: "user_advisor",
            actorType: "advisor",
            owner: "client",
            message: "Adjunta el contrato firmado.",
            dueDate: new Date("2026-04-15T00:00:00.000Z"),
            status: "resolved",
            resolvedAt: new Date("2026-04-10T09:00:00.000Z"),
            resolvedByUserId: "user_client",
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-04-10T09:00:00.000Z"),
          }
        },
        findMany: async () => [],
      },
    }
  )

  assert.equal(request.status, "resolved")
  assert.equal(request.resolvedByUserId, "user_client")
  assert.equal(calls[0]?.where.id, "request_1")
  assert.equal(calls[0]?.data.status, "resolved")
})

test("getFiscalReviewQueue refleja incidencias abiertas y ownership del cliente", async () => {
  const queue = await getFiscalReviewQueue("profile_1", {
    transactionFiscal: {
      findMany: async () => [
        {
          id: "fiscal_doc_1",
          ownerScopeId: "profile_1",
          sourceTransactionId: "tx_1",
          documentKind: "received_invoice",
          issueDate: new Date("2026-03-05T00:00:00.000Z"),
          counterpartyRole: "supplier",
          counterpartyName: "Proveedor Uno",
          counterpartyTaxId: "B12345678",
          reviewStatus: "needs_review",
          reviewReasons: ["missing_counterparty_tax_id"],
          vatPeriodAssignment: {
            fiscal_year: 2026,
            quarter: 1,
            period_key: "2026-Q1",
            basis: "issue_date",
            assigned_at: "2026-03-05T00:00:00.000Z",
          },
          withholdingPeriodAssignment: null,
        },
      ],
    },
    fiscalReviewRequest: {
      findMany: async (args) => {
        assert.deepEqual(args.where, {
          ownerScopeId: "profile_1",
          status: "open",
          fiscalDocumentId: {
            in: ["fiscal_doc_1"],
          },
        })

        return [
          {
            id: "request_1",
            fiscalDocumentId: "fiscal_doc_1",
            actorType: "advisor",
            owner: "client",
            message: "Adjunta el NIF correcto de la contraparte.",
            dueDate: new Date("2026-04-15T00:00:00.000Z"),
            status: "open",
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-03-23T10:00:00.000Z"),
          },
        ]
      },
    },
  })

  assert.equal(queue.summary.total, 1)
  assert.equal(queue.items[0]?.owner, "client")
  assert.equal(queue.items[0]?.active_request_count, 1)
  assert.equal(queue.items[0]?.active_requests[0]?.message, "Adjunta el NIF correcto de la contraparte.")
  assert.equal(queue.items[0]?.active_requests[0]?.due_date, "2026-04-15")
})
