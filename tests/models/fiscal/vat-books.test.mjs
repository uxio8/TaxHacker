import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildIssuedVatBookLines,
  buildReceivedVatBookLines,
  buildVatBooks,
} from "../../../models/fiscal/vat-books.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function getGoldenDocument(caseId) {
  const document = loadGoldenQuarter().documents.find((entry) => entry.case_id === caseId)

  assert.ok(document, `No existe el caso ${caseId} en el golden quarter`)
  return document
}

test("buildVatBooks reproduce el oracle trimestral del golden quarter", () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = [...goldenQuarter.documents].reverse().map((entry) => entry.document)

  const vatBooks = buildVatBooks(documents)

  assert.deepEqual(vatBooks, goldenQuarter.expected_quarter.vat_books)
})

test("buildReceivedVatBookLines y buildIssuedVatBookLines filtran readiness y respetan direction/document_kind", () => {
  const readyReceived = getGoldenDocument("received-office-supplies")
  const readyIssued = getGoldenDocument("issued-services-invoice")
  const blockedPayroll = getGoldenDocument("payroll-placeholder-blocked")
  const notReadyReceived = {
    ...readyReceived.document,
    lines: readyReceived.document.lines.map((line) => ({
      ...line,
      is_ready_for_vat_books: false,
    })),
  }
  const invalidOutgoingReceivedCombo = {
    ...readyReceived.document,
    header: {
      ...readyReceived.document.header,
      direction: "outgoing",
    },
  }

  assert.deepEqual(
    buildReceivedVatBookLines([
      readyIssued.document,
      blockedPayroll.document,
      notReadyReceived,
      invalidOutgoingReceivedCombo,
      readyReceived.document,
    ]),
    readyReceived.expected.vat_book_lines
  )

  assert.deepEqual(
    buildIssuedVatBookLines([
      readyReceived.document,
      blockedPayroll.document,
      readyIssued.document,
    ]),
    readyIssued.expected.vat_book_lines
  )
})
