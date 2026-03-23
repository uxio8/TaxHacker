import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  FISCAL_PROFILE_FORM_DEFAULTS,
  fiscalProfileFormSchema,
} from "../../../forms/fiscal/profile.ts"

test("fiscalProfileFormSchema normaliza el nombre y aplica los valores fijos de V1", () => {
  const parsed = fiscalProfileFormSchema.parse({
    companyName: "  LedgerFlow    Demo   SL  ",
    taxId: "  b11.223.344  ",
  })

  assert.deepEqual(parsed, {
    companyName: "LedgerFlow Demo SL",
    taxId: "b11.223.344",
    vatCashAccountingEnabled: false,
    ...FISCAL_PROFILE_FORM_DEFAULTS,
  })
})

test("fiscalProfileFormSchema convierte el ajuste de IVA de caja desde FormData", () => {
  const parsed = fiscalProfileFormSchema.parse({
    companyName: "LedgerFlow Demo SL",
    taxId: "B11223344",
    vatCashAccountingEnabled: "on",
  })

  assert.equal(parsed.vatCashAccountingEnabled, true)
})

test("fiscalProfileFormSchema exige nombre y NIF fiscal", () => {
  const result = fiscalProfileFormSchema.safeParse({
    companyName: "   ",
    taxId: "",
  })

  assert.equal(result.success, false)
  assert.match(result.error.issues[0]?.message ?? "", /nombre fiscal/i)
  assert.match(result.error.issues[1]?.message ?? "", /NIF fiscal/i)
})

test("fiscalProfileFormSchema rechaza configuraciones fuera de ES EUR spanish_sl", () => {
  const result = fiscalProfileFormSchema.safeParse({
    companyName: "LedgerFlow Demo SL",
    taxId: "B11223344",
    countryCode: "PT",
    currencyCode: "USD",
    legalEntityType: "spanish_sa",
  })

  assert.equal(result.success, false)
  assert.match(result.error.issues[0]?.message ?? "", /ES/i)
  assert.match(result.error.issues[1]?.message ?? "", /EUR/i)
  assert.match(result.error.issues[2]?.message ?? "", /spanish_sl/i)
})

test("business settings delega la identidad fiscal canonica a /settings/fiscal", async () => {
  const businessSettingsFormSource = await readFile(
    path.resolve(process.cwd(), "components/settings/business-settings-form.tsx"),
    "utf8"
  )

  assert.doesNotMatch(businessSettingsFormSource, /name="businessName"/)
  assert.doesNotMatch(businessSettingsFormSource, /name="businessTaxId"/)
  assert.match(businessSettingsFormSource, /href="\/settings\/fiscal"/)
})

test("saveProfileAction no vuelve a persistir businessName ni businessTaxId", async () => {
  const actionsSource = await readFile(path.resolve(process.cwd(), "app/(app)/settings/actions.ts"), "utf8")
  const saveProfileActionSource = actionsSource.match(
    /export async function saveProfileAction[\s\S]*?revalidatePath\("\/settings\/business"\)\n  return \{ success: true \}\n\}/
  )?.[0]

  assert.ok(saveProfileActionSource, "No se ha podido localizar saveProfileAction")
  assert.doesNotMatch(saveProfileActionSource, /businessName:/)
  assert.doesNotMatch(saveProfileActionSource, /businessTaxId:/)
})
