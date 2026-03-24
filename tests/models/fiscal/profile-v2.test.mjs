import assert from "node:assert/strict"
import test from "node:test"

import { upsertFiscalProfileForOrganization } from "../../../models/fiscal/profile.ts"

function createBootstrapUser(overrides = {}) {
  return {
    id: "user_1",
    defaultOrganizationId: "org_1",
    businessName: "LedgerFlow Demo SL",
    businessTaxId: "B11223344",
    ...overrides,
  }
}

test("upsertFiscalProfileForOrganization persiste flags fiscales operativos con defaults seguros", async () => {
  const calls = []
  const store = {
    user: {
      findUnique: async () => createBootstrapUser(),
    },
    fiscalProfile: {
      findUnique: async () => null,
      upsert: async (args) => {
        calls.push(args)
        return {
          id: "org_1",
          userId: "user_1",
          organizationId: "org_1",
          companyName: "LedgerFlow Demo SL",
          taxId: "B11223344",
          taxIdNormalized: "B11223344",
          countryCode: "ES",
          currencyCode: "EUR",
          legalEntityType: "spanish_sl",
          vatCashAccountingEnabled: false,
          hasEmployees: false,
          hasRentWithholding: false,
          hasProfessionalWithholding: false,
          hasIntraEuOperations: false,
          issuesInvoices: true,
          annualCloseMonth: 12,
        }
      },
    },
  }

  const profile = await upsertFiscalProfileForOrganization(
    "org_1",
    "user_1",
    {
      companyName: "LedgerFlow Demo SL",
      taxId: "B11223344",
      issuesInvoices: true,
    },
    store
  )

  assert.equal(profile.hasEmployees, false)
  assert.equal(profile.hasRentWithholding, false)
  assert.equal(profile.hasProfessionalWithholding, false)
  assert.equal(profile.hasIntraEuOperations, false)
  assert.equal(profile.issuesInvoices, true)
  assert.equal(profile.annualCloseMonth, 12)
  assert.deepEqual(calls[0]?.update, {
    companyName: "LedgerFlow Demo SL",
    taxId: "B11223344",
    taxIdNormalized: "B11223344",
    countryCode: "ES",
    currencyCode: "EUR",
    legalEntityType: "spanish_sl",
    vatCashAccountingEnabled: false,
    hasEmployees: false,
    hasRentWithholding: false,
    hasProfessionalWithholding: false,
    hasIntraEuOperations: false,
    issuesInvoices: true,
    annualCloseMonth: 12,
  })
})

test("upsertFiscalProfileForOrganization valida annualCloseMonth y normaliza flags operativos", async () => {
  const store = {
    user: {
      findUnique: async () => createBootstrapUser(),
    },
    fiscalProfile: {
      findUnique: async () => null,
      upsert: async (args) => ({
        id: "org_1",
        userId: "user_1",
        organizationId: "org_1",
        ...args.create,
      }),
    },
  }

  const profile = await upsertFiscalProfileForOrganization(
    "org_1",
    "user_1",
    {
      companyName: "LedgerFlow Demo SL",
      taxId: "B11223344",
      vatCashAccountingEnabled: true,
      hasEmployees: true,
      hasRentWithholding: true,
      hasProfessionalWithholding: true,
      hasIntraEuOperations: false,
      issuesInvoices: false,
      annualCloseMonth: 6,
    },
    store
  )

  assert.equal(profile.vatCashAccountingEnabled, true)
  assert.equal(profile.hasEmployees, true)
  assert.equal(profile.hasRentWithholding, true)
  assert.equal(profile.hasProfessionalWithholding, true)
  assert.equal(profile.hasIntraEuOperations, false)
  assert.equal(profile.issuesInvoices, false)
  assert.equal(profile.annualCloseMonth, 6)

  await assert.rejects(
    upsertFiscalProfileForOrganization(
      "org_1",
      "user_1",
      {
        companyName: "LedgerFlow Demo SL",
        taxId: "B11223344",
        annualCloseMonth: 13,
      },
      store
    ),
    /annualCloseMonth/
  )
})
