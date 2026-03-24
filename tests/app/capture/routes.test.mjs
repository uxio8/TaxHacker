import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("/capture usa una entrada server-first y monta el uploader movil", async () => {
  const source = await readFile(path.resolve(process.cwd(), "app/(app)/capture/page.tsx"), "utf8")

  assert.match(source, /createPageMetadata\("capture\.title"/)
  assert.match(source, /MobileCaptureUploader/)
  assert.match(source, /capture\.hero\.title/)
})

test("/capture/inbox mantiene fallback legado pero queda preparado para el reader del slice documental bajo flag", async () => {
  const source = await readFile(path.resolve(process.cwd(), "app/(app)/capture/inbox/page.tsx"), "utf8")

  assert.match(source, /config\.workflow\.documentSliceEnabled/)
  assert.match(source, /getCaptureWorkflowInboxView/)
  assert.match(source, /fetch\(`\$\{config\.app\.baseURL\}\/api\/mobile\/inbox`/)
  assert.match(source, /buildOrganizationActionUser/)
  assert.match(source, /MobileInbox/)
})

test("/capture/review/[fileId] resuelve el archivo, la ficha rapida y las acciones de review", async () => {
  const source = await readFile(path.resolve(process.cwd(), "app/(app)/capture/review/[fileId]/page.tsx"), "utf8")

  assert.match(source, /getFileById/)
  assert.match(source, /MobileReview/)
  assert.match(source, /notFound\(/)
})

test("las acciones de review reutilizan guardar transaccion, reintento de analisis y defer al escritorio", async () => {
  const source = await readFile(path.resolve(process.cwd(), "app/(app)/capture/review/[fileId]/actions.ts"), "utf8")
  const coreSource = await readFile(
    path.resolve(process.cwd(), "app/(app)/capture/review/[fileId]/review-actions-core.ts"),
    "utf8"
  )

  assert.match(source, /saveFileAsTransactionAction/)
  assert.match(source, /startAnalysisJobAction/)
  assert.match(source, /updateFile/)
  assert.match(source, /createMobileReviewActions/)
  assert.match(coreSource, /revalidatePath\("\/capture\/inbox"\)/)
})
