import assert from "node:assert/strict"
import test from "node:test"

import {
  CounterpartyIdentityConflictError,
  buildCounterpartyIdentity,
  getCounterparties,
  getCounterpartyQualityStatus,
  summarizeCounterpartyQuality,
  upsertCounterparty,
} from "../../../models/fiscal/counterparties.ts"

test("buildCounterpartyIdentity prioriza NIF y genera clave canonica ES:NIF", () => {
  const identity = buildCounterpartyIdentity({
    displayName: "Papeleria Centro SL",
    taxId: " b12-345678 ",
  })

  assert.deepEqual(identity, {
    canonicalIdentityKey: "ES:NIF:B12345678",
    countryCode: "ES",
    displayName: "Papeleria Centro SL",
    identityBasis: "tax_id",
    normalizedName: "PAPELERIA CENTRO SL",
    taxId: "B12345678",
    taxIdNormalized: "B12345678",
  })
})

test("buildCounterpartyIdentity usa fallback por nombre cuando falta NIF", () => {
  const identity = buildCounterpartyIdentity({
    displayName: " Nomina empleada 01 ",
  })

  assert.deepEqual(identity, {
    canonicalIdentityKey: "ES:NAME:NOMINA_EMPLEADA_01",
    countryCode: "ES",
    displayName: "Nomina empleada 01",
    identityBasis: "name_fallback",
    normalizedName: "NOMINA EMPLEADA 01",
    taxId: null,
    taxIdNormalized: "none",
  })
})

test("getCounterpartyQualityStatus distingue fiable, pendiente de NIF e inactiva", () => {
  assert.equal(
    getCounterpartyQualityStatus({
      identityBasis: "tax_id",
      isActive: true,
      taxIdNormalized: "B12345678",
    }),
    "reliable"
  )

  assert.equal(
    getCounterpartyQualityStatus({
      identityBasis: "name_fallback",
      isActive: true,
      taxIdNormalized: "none",
    }),
    "needs_tax_id"
  )

  assert.equal(
    getCounterpartyQualityStatus({
      identityBasis: "tax_id",
      isActive: false,
      taxIdNormalized: "B12345678",
    }),
    "inactive"
  )
})

test("summarizeCounterpartyQuality agrega el maestro por calidad operativa", () => {
  assert.deepEqual(
    summarizeCounterpartyQuality([
      {
        identityBasis: "tax_id",
        isActive: true,
        taxIdNormalized: "B12345678",
      },
      {
        identityBasis: "name_fallback",
        isActive: true,
        taxIdNormalized: "none",
      },
      {
        identityBasis: "tax_id",
        isActive: false,
        taxIdNormalized: "B87654321",
      },
    ]),
    {
      reliable: 1,
      needs_tax_id: 1,
      inactive: 1,
    }
  )
})

test("upsertCounterparty consolida un fallback previo a identidad por NIF sin cambiar id", async () => {
  const findUniqueCalls = []
  const updateCalls = []

  const counterparty = await upsertCounterparty("fp_1", {
    displayName: "Papeleria Centro SL",
    taxId: "B12345678",
  }, {
    counterparty: {
      create: async () => {
        throw new Error("no deberia crear una contraparte nueva")
      },
      findFirst: async () => null,
      findMany: async () => [],
      findUnique: async (args) => {
        findUniqueCalls.push(args)

        const key = args.where.ownerScopeId_canonicalIdentityKey.canonicalIdentityKey

        if (key === "ES:NIF:B12345678") {
          return null
        }

        if (key === "ES:NAME:PAPELERIA_CENTRO_SL") {
          return {
            id: "cp_existing",
            ownerScopeId: "fp_1",
            canonicalIdentityKey: "ES:NAME:PAPELERIA_CENTRO_SL",
            identityBasis: "name_fallback",
            displayName: "Papeleria Centro SL",
            normalizedName: "PAPELERIA CENTRO SL",
            taxId: null,
            taxIdNormalized: "none",
            countryCode: "ES",
            isActive: true,
          }
        }

        return null
      },
      update: async (args) => {
        updateCalls.push(args)
        return {
          id: "cp_existing",
          ownerScopeId: "fp_1",
          createdAt: new Date("2026-03-21T00:00:00.000Z"),
          updatedAt: new Date("2026-03-21T00:00:00.000Z"),
          ...args.data,
        }
      },
    },
  })

  assert.equal(counterparty.id, "cp_existing")
  assert.equal(counterparty.canonicalIdentityKey, "ES:NIF:B12345678")
  assert.equal(counterparty.identityBasis, "tax_id")
  assert.equal(counterparty.taxIdNormalized, "B12345678")
  assert.deepEqual(findUniqueCalls, [
    {
      where: {
        ownerScopeId_canonicalIdentityKey: {
          ownerScopeId: "fp_1",
          canonicalIdentityKey: "ES:NIF:B12345678",
        },
      },
    },
    {
      where: {
        ownerScopeId_canonicalIdentityKey: {
          ownerScopeId: "fp_1",
          canonicalIdentityKey: "ES:NAME:PAPELERIA_CENTRO_SL",
        },
      },
    },
  ])
  assert.deepEqual(updateCalls, [
    {
      where: { id: "cp_existing" },
      data: {
        canonicalIdentityKey: "ES:NIF:B12345678",
        identityBasis: "tax_id",
        displayName: "Papeleria Centro SL",
        normalizedName: "PAPELERIA CENTRO SL",
        taxId: "B12345678",
        taxIdNormalized: "B12345678",
        countryCode: "ES",
        isActive: true,
      },
    },
  ])
})

test("upsertCounterparty falla si la consolidacion colisiona con otra identidad por NIF", async () => {
  await assert.rejects(
    upsertCounterparty("fp_1", {
      displayName: "Papeleria Centro SL",
      taxId: "B12345678",
    }, {
      counterparty: {
        create: async () => {
          throw new Error("no deberia crear una contraparte nueva")
        },
        findFirst: async () => null,
        findMany: async () => [],
        findUnique: async (args) => {
          const key = args.where.ownerScopeId_canonicalIdentityKey.canonicalIdentityKey

          if (key === "ES:NIF:B12345678") {
            return {
              id: "cp_tax",
              ownerScopeId: "fp_1",
              canonicalIdentityKey: "ES:NIF:B12345678",
              identityBasis: "tax_id",
              displayName: "Papeleria Centro SL",
              normalizedName: "PAPELERIA CENTRO SL",
              taxId: "B12345678",
              taxIdNormalized: "B12345678",
              countryCode: "ES",
              isActive: true,
            }
          }

          if (key === "ES:NAME:PAPELERIA_CENTRO_SL") {
            return {
              id: "cp_fallback",
              ownerScopeId: "fp_1",
              canonicalIdentityKey: "ES:NAME:PAPELERIA_CENTRO_SL",
              identityBasis: "name_fallback",
              displayName: "Papeleria Centro SL",
              normalizedName: "PAPELERIA CENTRO SL",
              taxId: null,
              taxIdNormalized: "none",
              countryCode: "ES",
              isActive: true,
            }
          }

          return null
        },
        update: async () => {
          throw new Error("no deberia actualizar una contraparte en conflicto")
        },
      },
    }),
    CounterpartyIdentityConflictError
  )
})

test("upsertCounterparty reintenta dentro de transaccion cuando hay colision concurrente y evita propagar P2002", async () => {
  const transactionCalls = []
  let createAttempts = 0

  const store = {
    $transaction: async (callback) => {
      transactionCalls.push("tx")
      return callback(store)
    },
    counterparty: {
      findFirst: async () => null,
      findMany: async () => [],
      findUnique: async (args) => {
        const key = args.where.ownerScopeId_canonicalIdentityKey.canonicalIdentityKey

        if (key !== "ES:NIF:B12345678") {
          return null
        }

        if (createAttempts === 0) {
          return null
        }

        return {
          id: "cp_race",
          ownerScopeId: "fp_1",
          canonicalIdentityKey: "ES:NIF:B12345678",
          identityBasis: "tax_id",
          displayName: "Papeleria Centro SL",
          normalizedName: "PAPELERIA CENTRO SL",
          taxId: "B12345678",
          taxIdNormalized: "B12345678",
          countryCode: "ES",
          isActive: true,
        }
      },
      create: async () => {
        createAttempts += 1

        if (createAttempts === 1) {
          const error = new Error("unique constraint")
          error.code = "P2002"
          throw error
        }

        throw new Error("no deberia volver a intentar crear cuando el retry ya ve la fila")
      },
      update: async (args) => ({
        id: "cp_race",
        ownerScopeId: "fp_1",
        createdAt: new Date("2026-03-21T00:00:00.000Z"),
        updatedAt: new Date("2026-03-21T00:00:00.000Z"),
        ...args.data,
      }),
    },
  }

  const counterparty = await upsertCounterparty("fp_1", {
    displayName: "Papeleria Centro SL",
    taxId: "B12345678",
  }, store)

  assert.equal(counterparty.id, "cp_race")
  assert.equal(createAttempts, 1)
  assert.equal(transactionCalls.length, 2)
})

test("getCounterparties lee el maestro por owner scope", async () => {
  const counterparties = await getCounterparties("fp_1", {
    counterparty: {
      create: async () => {
        throw new Error("no deberia crear en lectura")
      },
      findFirst: async () => null,
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { ownerScopeId: "fp_1" },
          orderBy: { displayName: "asc" },
        })

        return [
          {
            id: "cp_1",
            ownerScopeId: "fp_1",
            canonicalIdentityKey: "ES:NIF:B99887766",
            identityBasis: "tax_id",
            displayName: "Cliente Demo SL",
            normalizedName: "CLIENTE DEMO SL",
            taxId: "B99887766",
            taxIdNormalized: "B99887766",
            countryCode: "ES",
            isActive: true,
          },
        ]
      },
      findUnique: async () => null,
      update: async () => {
        throw new Error("no deberia actualizar en lectura")
      },
    },
  })

  assert.equal(counterparties.length, 1)
  assert.equal(counterparties[0].id, "cp_1")
})
