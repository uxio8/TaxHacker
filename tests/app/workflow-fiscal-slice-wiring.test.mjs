import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("tax y archive quedan cableados a la read API fiscal bajo flag", async () => {
  const [taxPageSource, archivePageSource, archiveDetailPageSource, annualArchivePageSource, configSource] = await Promise.all([
    readProjectFile("app/(app)/tax/page.tsx"),
    readProjectFile("app/(app)/tax/archive/page.tsx"),
    readProjectFile("app/(app)/tax/archive/[periodId]/page.tsx"),
    readProjectFile("app/(app)/tax/archive/annual/page.tsx"),
    readProjectFile("lib/config.ts"),
  ])

  assert.match(configSource, /WORKFLOW_FISCAL_SLICE/)
  assert.match(configSource, /fiscalSliceEnabled/)

  assert.match(taxPageSource, /config\.workflow\.fiscalSliceEnabled/)
  assert.match(taxPageSource, /getTaxWorkflowFiscalView/)

  assert.match(archivePageSource, /config\.workflow\.fiscalSliceEnabled/)
  assert.match(archivePageSource, /getTaxArchiveWorkflowView/)

  assert.match(archiveDetailPageSource, /config\.workflow\.fiscalSliceEnabled/)
  assert.match(archiveDetailPageSource, /getTaxArchivePeriodWorkflowView/)

  assert.match(annualArchivePageSource, /config\.workflow\.fiscalSliceEnabled/)
  assert.match(annualArchivePageSource, /getAnnualArchiveWorkflowView/)
})
