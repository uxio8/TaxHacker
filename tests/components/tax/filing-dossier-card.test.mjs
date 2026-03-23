import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

test("el panel compartido del expediente permite estado, referencia, notas y justificante", async () => {
  const cardSource = await readSource("components/tax/forms/shared/filing-dossier-card.tsx")

  assert.match(cardSource, /useActionState/)
  assert.match(cardSource, /saveFiscalFilingDossierAction/)
  assert.match(cardSource, /name="status"/)
  assert.match(cardSource, /name="filingReference"/)
  assert.match(cardSource, /name="filingNotes"/)
  assert.match(cardSource, /name="receipt"/)
  assert.match(cardSource, /draft_ready/)
  assert.match(cardSource, /ready_to_file/)
  assert.match(cardSource, /filed/)
})

test("los formularios 303, 115, 180 y 390 renderizan el panel compartido del expediente", async () => {
  const source303 = await readSource("components/tax/forms/303/model-303-draft-view.tsx")
  const source115 = await readSource("components/tax/forms/115/model-115-draft-view.tsx")
  const source180 = await readSource("components/tax/forms/180/model-180-draft-view.tsx")
  const source390 = await readSource("components/tax/forms/390/model-390-draft-view.tsx")

  assert.match(source303, /FilingDossierCard/)
  assert.match(source115, /FilingDossierCard/)
  assert.match(source180, /FilingDossierCard/)
  assert.match(source390, /FilingDossierCard/)
})

test("el archivo fiscal expone la entrada al cierre anual ligero y su card dedicada", async () => {
  const archiveSource = await readSource("app/(app)/tax/archive/page.tsx")
  const annualPageSource = await readSource("app/(app)/tax/archive/annual/page.tsx")
  const annualCardSource = await readSource("components/tax/archive/annual-handoff-card.tsx")

  assert.match(archiveSource, /\/tax\/archive\/annual/)
  assert.match(annualPageSource, /AnnualHandoffCard/)
  assert.match(annualCardSource, /Cierre anual ligero/)
  assert.match(annualCardSource, /Sin automatización contable/)
})
