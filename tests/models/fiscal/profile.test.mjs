import assert from "node:assert/strict"
import test from "node:test"

import {
  ensureFiscalProfileForOrganization,
  ensureFiscalProfileForUser,
  getFiscalProfileAccessByOrganizationId,
  getFiscalProfileAccessByUserId,
  getFiscalProfileByOrganizationId,
  getFiscalProfileByUserId,
  upsertFiscalProfile,
  upsertFiscalProfileForOrganization,
} from "../../../models/fiscal/profile.ts"
import { FiscalStorageNotReadyError } from "../../../models/fiscal/storage.ts"

function createBootstrapUser(overrides = {}) {
  return {
    id: "user_1",
    defaultOrganizationId: "org_1",
    businessName: "LedgerFlow Demo SL",
    businessTaxId: " B11.223.344 ",
    ...overrides,
  }
}

test("upsertFiscalProfileForOrganization normaliza NIF, fija ES/EUR para V1 y persiste vatCashAccountingEnabled", async () => {
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
          vatCashAccountingEnabled: true,
        }
      },
    },
  }

  const profile = await upsertFiscalProfileForOrganization(
    "org_1",
    "user_1",
    {
      companyName: " LedgerFlow Demo SL ",
      taxId: " b11.223.344 ",
      vatCashAccountingEnabled: true,
    },
    store
  )

  assert.equal(profile.taxId, "B11223344")
  assert.equal(profile.taxIdNormalized, "B11223344")
  assert.equal(profile.countryCode, "ES")
  assert.equal(profile.currencyCode, "EUR")
  assert.equal(profile.legalEntityType, "spanish_sl")
  assert.equal(profile.vatCashAccountingEnabled, true)
  assert.deepEqual(calls, [
    {
      where: { organizationId: "org_1" },
      update: {
        companyName: "LedgerFlow Demo SL",
        taxId: "B11223344",
        taxIdNormalized: "B11223344",
        countryCode: "ES",
        currencyCode: "EUR",
        legalEntityType: "spanish_sl",
        vatCashAccountingEnabled: true,
        hasEmployees: false,
        hasRentWithholding: false,
        hasProfessionalWithholding: false,
        hasIntraEuOperations: false,
        issuesInvoices: true,
        annualCloseMonth: 12,
      },
      create: {
        id: "org_1",
        userId: "user_1",
        organizationId: "org_1",
        companyName: "LedgerFlow Demo SL",
        taxId: "B11223344",
        taxIdNormalized: "B11223344",
        countryCode: "ES",
        currencyCode: "EUR",
        legalEntityType: "spanish_sl",
        vatCashAccountingEnabled: true,
        hasEmployees: false,
        hasRentWithholding: false,
        hasProfessionalWithholding: false,
        hasIntraEuOperations: false,
        issuesInvoices: true,
        annualCloseMonth: 12,
      },
    },
  ])
})

test("upsertFiscalProfile legacy resuelve la organizacion por defaultOrganizationId", async () => {
  const calls = []
  const store = {
    user: {
      findUnique: async (args) => {
        assert.deepEqual(args, {
          where: { id: "user_1" },
          select: {
            id: true,
            defaultOrganizationId: true,
            businessName: true,
            businessTaxId: true,
          },
        })

        return createBootstrapUser()
      },
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
        }
      },
    },
  }

  await upsertFiscalProfile(
    "user_1",
    {
      companyName: "LedgerFlow Demo SL",
      taxId: "B11223344",
    },
    store
  )

  assert.equal(calls[0]?.where.organizationId, "org_1")
})

test("upsertFiscalProfileForOrganization rechaza monedas fuera de EUR", async () => {
  await assert.rejects(
    upsertFiscalProfileForOrganization(
      "org_1",
      "user_1",
      {
        companyName: "LedgerFlow Demo SL",
        taxId: "B11223344",
        currencyCode: "USD",
      },
      {
        user: {
          findUnique: async () => createBootstrapUser(),
        },
        fiscalProfile: {
          findUnique: async () => null,
          upsert: async () => {
            throw new Error("no deberia llamarse")
          },
        },
      }
    ),
    /EUR/
  )
})

test("getFiscalProfileByOrganizationId lee el perfil fiscal unico de la organizacion", async () => {
  const profile = await getFiscalProfileByOrganizationId("org_1", "user_1", {
    user: {
      findUnique: async () => createBootstrapUser(),
    },
    fiscalProfile: {
      findUnique: async (args) => {
        assert.deepEqual(args, {
          where: { organizationId: "org_1" },
        })

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
        }
      },
    },
  })

  assert.equal(profile?.id, "org_1")
})

test("getFiscalProfileByUserId asegura el perfil desde datos fiscales del usuario y lo ata a la organizacion activa", async () => {
  const calls = []

  const profile = await getFiscalProfileByUserId("user_1", {
    user: {
      findUnique: async () => createBootstrapUser(),
    },
    fiscalProfile: {
      findUnique: async (args) => {
        calls.push(args)
        return null
      },
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
        }
      },
    },
  })

  assert.equal(profile?.id, "org_1")
  assert.deepEqual(calls, [
    {
      where: { organizationId: "org_1" },
    },
    {
      where: { organizationId: "org_1" },
      update: {
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
      },
      create: {
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
      },
    },
  ])
})

test("ensureFiscalProfileForOrganization devuelve null si el usuario bootstrap no tiene datos fiscales suficientes", async () => {
  const profile = await ensureFiscalProfileForOrganization("org_1", "user_1", {
    user: {
      findUnique: async () => createBootstrapUser({
        businessName: null,
        businessTaxId: "   ",
      }),
    },
    fiscalProfile: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("no deberia crear un perfil fiscal sin NIF")
      },
    },
  })

  assert.equal(profile, null)
})

test("ensureFiscalProfileForUser no usa user.name como fallback al backfill fiscal", async () => {
  const profile = await ensureFiscalProfileForUser("user_1", {
    user: {
      findUnique: async () => createBootstrapUser({
        businessName: null,
        businessTaxId: "B11223344",
      }),
    },
    fiscalProfile: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("no deberia crear un perfil fiscal usando el nombre de cuenta")
      },
    },
  })

  assert.equal(profile, null)
})

test("getFiscalProfileAccessByOrganizationId devuelve storage_not_ready cuando faltan tablas fiscales", async () => {
  const access = await getFiscalProfileAccessByOrganizationId("org_1", "user_1", {
    user: {
      findUnique: async () => createBootstrapUser(),
    },
    fiscalProfile: {
      findUnique: async () => {
        throw new FiscalStorageNotReadyError()
      },
    },
  })

  assert.deepEqual(access, {
    status: "storage_not_ready",
    profile: null,
  })
})

test("getFiscalProfileAccessByUserId resuelve la organizacion activa del usuario antes de leer el perfil", async () => {
  const access = await getFiscalProfileAccessByUserId("user_1", {
    user: {
      findUnique: async () => createBootstrapUser(),
    },
    fiscalProfile: {
      findUnique: async () => ({
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
      }),
    },
  })

  assert.equal(access.status, "ready")
  assert.equal(access.profile.organizationId, "org_1")
})
