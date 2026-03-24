import { readFileSync } from "node:fs"
import path from "node:path"
import { Prisma } from "../../../prisma/client/index.js"
import { prisma } from "../../../lib/db.ts"
import { buildCounterpartyIdentity } from "../../../models/fiscal/counterparties.ts"
import { syncFiscalObligationsForOrganization } from "../../../models/fiscal/obligations.ts"
import { syncDefaultSpanishFiscalPeriodsV1 } from "../../../models/fiscal/periods.ts"
import { upsertFiscalProfileForOrganization } from "../../../models/fiscal/profile.ts"
import { getOrCreateSelfHostedUser } from "../../../models/users.ts"

const FIXTURE_IDS = {
  landlordCounterpartyId: "11111111-1111-4111-8111-111111111111",
  rentTransactionId: "22222222-2222-4222-8222-222222222222",
  reviewTransactionId: "33333333-3333-4333-8333-333333333333",
  rentFiscalDocumentId: "fiscal-smoke-rent-2026-q1",
  reviewFiscalDocumentId: "fiscal-smoke-review-2026-q1",
} as const

type GoldenQuarterFixture = {
  documents: Array<{
    case_id: string
    document: {
      header: Record<string, unknown>
      lines: Array<Record<string, unknown>>
    }
  }>
}

function loadGoldenQuarterFixture(): GoldenQuarterFixture {
  const fixturePath = path.resolve(process.cwd(), "tests/fixtures/fiscal/golden-quarter.json")
  return JSON.parse(readFileSync(fixturePath, "utf8")) as GoldenQuarterFixture
}

function getGoldenDocument(caseId: string) {
  const entry = loadGoldenQuarterFixture().documents.find((item) => item.case_id === caseId)

  if (!entry) {
    throw new Error(`No existe el caso ${caseId} en el golden quarter.`)
  }

  return entry.document
}

function asDate(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Se esperaba una fecha serializada en el fixture.")
  }

  return new Date(`${value}T00:00:00.000Z`)
}

function asJson<T>(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as T
}

export async function seedFiscalSmokeData() {
  const user = await getOrCreateSelfHostedUser()
  const organizationId = user.defaultOrganizationId ?? user.id
  const fiscalProfile = await upsertFiscalProfileForOrganization(organizationId, user.id, {
    companyName: "LedgerFlow Fiscal Smoke SL",
    taxId: "B11223344",
    countryCode: "ES",
    currencyCode: "EUR",
    legalEntityType: "spanish_sl",
    vatCashAccountingEnabled: false,
    hasEmployees: true,
    hasRentWithholding: true,
    hasProfessionalWithholding: false,
    hasIntraEuOperations: false,
    issuesInvoices: true,
    annualCloseMonth: 12,
  })

  await syncDefaultSpanishFiscalPeriodsV1(fiscalProfile.id)

  const obligationPeriodKeys = ["2026-Q1", "2026-Y"]
  const obligationCodes = ["303", "115", "111_manual", "180", "390", "347", "349"]
  const existingObligations = await prisma.fiscalObligation.findMany({
    where: {
      organizationId,
      code: {
        in: obligationCodes,
      },
      periodKey: {
        in: obligationPeriodKeys,
      },
    },
    select: {
      id: true,
    },
  })

  if (existingObligations.length > 0) {
    await prisma.fiscalFilingDossier.deleteMany({
      where: {
        fiscalObligationId: {
          in: existingObligations.map((obligation) => obligation.id),
        },
      },
    })

    await prisma.fiscalObligation.deleteMany({
      where: {
        id: {
          in: existingObligations.map((obligation) => obligation.id),
        },
      },
    })
  }

  await prisma.fiscalReviewRequest.deleteMany({
    where: {
      fiscalDocumentId: {
        in: [FIXTURE_IDS.rentFiscalDocumentId, FIXTURE_IDS.reviewFiscalDocumentId],
      },
    },
  })

  await prisma.transactionFiscalLine.deleteMany({
    where: {
      transactionFiscalId: {
        in: [FIXTURE_IDS.rentFiscalDocumentId, FIXTURE_IDS.reviewFiscalDocumentId],
      },
    },
  })

  await prisma.transactionFiscal.deleteMany({
    where: {
      id: {
        in: [FIXTURE_IDS.rentFiscalDocumentId, FIXTURE_IDS.reviewFiscalDocumentId],
      },
    },
  })

  await prisma.transaction.deleteMany({
    where: {
      id: {
        in: [FIXTURE_IDS.rentTransactionId, FIXTURE_IDS.reviewTransactionId],
      },
    },
  })

  await prisma.counterparty.deleteMany({
    where: {
      id: FIXTURE_IDS.landlordCounterpartyId,
    },
  })

  const rentFixture = getGoldenDocument("received-rent-withholding")
  const reviewFixture = getGoldenDocument("received-missing-counterparty-relation")

  const rentHeader = rentFixture.header
  const rentLine = rentFixture.lines[0]
  const reviewHeader = reviewFixture.header
  const reviewLine = reviewFixture.lines[0]
  const landlordIdentity = buildCounterpartyIdentity({
    displayName: String(rentHeader.counterparty_name),
    taxId: String(rentHeader.counterparty_tax_id),
  })

  await prisma.counterparty.create({
    data: {
      id: FIXTURE_IDS.landlordCounterpartyId,
      ownerScopeId: fiscalProfile.id,
      canonicalIdentityKey: landlordIdentity.canonicalIdentityKey,
      identityBasis: landlordIdentity.identityBasis,
      displayName: landlordIdentity.displayName,
      normalizedName: landlordIdentity.normalizedName,
      taxId: landlordIdentity.taxId,
      taxIdNormalized: landlordIdentity.taxIdNormalized,
      countryCode: landlordIdentity.countryCode,
      isActive: true,
    },
  })

  await prisma.transaction.create({
    data: {
      id: FIXTURE_IDS.rentTransactionId,
      userId: user.id,
      organizationId,
      name: "Alquiler local fiscal smoke",
      merchant: String(rentHeader.counterparty_name),
      total: Number(rentHeader.total_payable_cents),
      currencyCode: String(rentHeader.currency_code),
      type: "expense",
      issuedAt: asDate(rentHeader.issue_date),
      items: [],
      files: [],
    },
  })

  await prisma.transaction.create({
    data: {
      id: FIXTURE_IDS.reviewTransactionId,
      userId: user.id,
      organizationId,
      name: "Documento en revisión smoke",
      merchant: String(reviewHeader.counterparty_name),
      total: Number(reviewHeader.total_payable_cents),
      currencyCode: String(reviewHeader.currency_code),
      type: "expense",
      issuedAt: asDate(reviewHeader.issue_date),
      items: [],
      files: [],
    },
  })

  await prisma.transactionFiscal.create({
    data: {
      id: FIXTURE_IDS.rentFiscalDocumentId,
      ownerScopeId: fiscalProfile.id,
      sourceTransactionId: FIXTURE_IDS.rentTransactionId,
      documentKind: String(rentHeader.document_kind),
      direction: String(rentHeader.direction),
      invoiceNumber: String(rentHeader.invoice_number),
      invoiceSeries: rentHeader.invoice_series ? String(rentHeader.invoice_series) : null,
      issueDate: asDate(rentHeader.issue_date),
      operationDate: rentHeader.operation_date ? asDate(rentHeader.operation_date) : null,
      paymentDate: null,
      currencyCode: String(rentHeader.currency_code),
      counterpartyId: FIXTURE_IDS.landlordCounterpartyId,
      counterpartyRole: String(rentHeader.counterparty_role),
      counterpartyName: String(rentHeader.counterparty_name),
      counterpartyTaxId: String(rentHeader.counterparty_tax_id),
      counterpartyCountryCode: String(rentHeader.counterparty_country_code),
      companyTaxId: String(rentHeader.company_tax_id),
      reviewStatus: "ready",
      reviewReasons: [],
      vatPeriodAssignment: asJson(rentHeader.vat_period_assignment),
      withholdingPeriodAssignment: asJson(rentHeader.withholding_period_assignment),
      observedAmountCents: Number(rentHeader.observed_amount_cents),
      totalNetCents: Number(rentHeader.total_net_cents),
      totalVatCents: Number(rentHeader.total_vat_cents),
      totalWithholdingCents: Number(rentHeader.total_withholding_cents),
      totalGrossCents: Number(rentHeader.total_gross_cents),
      totalPayableCents: Number(rentHeader.total_payable_cents),
      sourceConfidence: String(rentHeader.source_confidence),
      notes: null,
    },
  })

  await prisma.transactionFiscalLine.create({
    data: {
      id: `${FIXTURE_IDS.rentFiscalDocumentId}-l1`,
      transactionFiscalId: FIXTURE_IDS.rentFiscalDocumentId,
      lineNumber: Number(rentLine.line_number),
      concept: String(rentLine.concept),
      baseAmountCents: Number(rentLine.base_amount_cents),
      vatTreatment: String(rentLine.vat_treatment),
      vatRateBps: Number(rentLine.vat_rate_bps),
      vatAmountCents: Number(rentLine.vat_amount_cents),
      withholdingApplicable: Boolean(rentLine.withholding_applicable),
      withholdingRegime: String(rentLine.withholding_regime),
      withholdingBaseCents: Number(rentLine.withholding_base_cents),
      withholdingRateBps: Number(rentLine.withholding_rate_bps),
      withholdingAmountCents: Number(rentLine.withholding_amount_cents),
      deductibilityPercentBps: Number(rentLine.deductibility_percent_bps),
      deductibilityReason: String(rentLine.deductibility_reason),
      expenseFamily: String(rentLine.expense_family),
      isReadyForVatBooks: Boolean(rentLine.is_ready_for_vat_books),
      isReadyForWithholdingBooks: Boolean(rentLine.is_ready_for_withholding_books),
    },
  })

  await prisma.transactionFiscal.create({
    data: {
      id: FIXTURE_IDS.reviewFiscalDocumentId,
      ownerScopeId: fiscalProfile.id,
      sourceTransactionId: FIXTURE_IDS.reviewTransactionId,
      documentKind: String(reviewHeader.document_kind),
      direction: String(reviewHeader.direction),
      invoiceNumber: String(reviewHeader.invoice_number),
      invoiceSeries: reviewHeader.invoice_series ? String(reviewHeader.invoice_series) : null,
      issueDate: asDate(reviewHeader.issue_date),
      operationDate: reviewHeader.operation_date ? asDate(reviewHeader.operation_date) : null,
      paymentDate: null,
      currencyCode: String(reviewHeader.currency_code),
      counterpartyId: null,
      counterpartyRole: String(reviewHeader.counterparty_role),
      counterpartyName: String(reviewHeader.counterparty_name),
      counterpartyTaxId: String(reviewHeader.counterparty_tax_id),
      counterpartyCountryCode: String(reviewHeader.counterparty_country_code),
      companyTaxId: String(reviewHeader.company_tax_id),
      reviewStatus: "needs_review",
      reviewReasons: ["missing_counterparty_relation"],
      vatPeriodAssignment: asJson(reviewHeader.vat_period_assignment),
      withholdingPeriodAssignment: Prisma.JsonNull,
      observedAmountCents: Number(reviewHeader.observed_amount_cents),
      totalNetCents: Number(reviewHeader.total_net_cents),
      totalVatCents: Number(reviewHeader.total_vat_cents),
      totalWithholdingCents: Number(reviewHeader.total_withholding_cents),
      totalGrossCents: Number(reviewHeader.total_gross_cents),
      totalPayableCents: Number(reviewHeader.total_payable_cents),
      sourceConfidence: String(reviewHeader.source_confidence),
      notes: "Smoke E2E: revisar contraparte antes de cerrar trimestre.",
    },
  })

  await prisma.transactionFiscalLine.create({
    data: {
      id: `${FIXTURE_IDS.reviewFiscalDocumentId}-l1`,
      transactionFiscalId: FIXTURE_IDS.reviewFiscalDocumentId,
      lineNumber: Number(reviewLine.line_number),
      concept: String(reviewLine.concept),
      baseAmountCents: Number(reviewLine.base_amount_cents),
      vatTreatment: String(reviewLine.vat_treatment),
      vatRateBps: Number(reviewLine.vat_rate_bps),
      vatAmountCents: Number(reviewLine.vat_amount_cents),
      withholdingApplicable: Boolean(reviewLine.withholding_applicable),
      withholdingRegime: String(reviewLine.withholding_regime),
      withholdingBaseCents: Number(reviewLine.withholding_base_cents),
      withholdingRateBps: Number(reviewLine.withholding_rate_bps),
      withholdingAmountCents: Number(reviewLine.withholding_amount_cents),
      deductibilityPercentBps: Number(reviewLine.deductibility_percent_bps),
      deductibilityReason: String(reviewLine.deductibility_reason),
      expenseFamily: String(reviewLine.expense_family),
      isReadyForVatBooks: Boolean(reviewLine.is_ready_for_vat_books),
      isReadyForWithholdingBooks: Boolean(reviewLine.is_ready_for_withholding_books),
    },
  })

  await syncFiscalObligationsForOrganization(organizationId)

  return {
    userId: user.id,
    organizationId,
    ownerScopeId: fiscalProfile.id,
    periodKey: "2026-Q1",
    annualPeriodKey: "2026-Y",
    rentInvoiceNumber: String(rentHeader.invoice_number),
    reviewFiscalDocumentId: FIXTURE_IDS.reviewFiscalDocumentId,
    reviewInvoiceNumber: String(reviewHeader.invoice_number),
    reviewCounterpartyName: String(reviewHeader.counterparty_name),
  }
}
