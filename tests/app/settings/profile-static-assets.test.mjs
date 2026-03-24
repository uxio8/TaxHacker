import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("saveProfileAction construye URLs estáticas canónicas por organización", async () => {
  const actionsSource = await readFile(path.resolve(process.cwd(), "app/(app)/settings/actions.ts"), "utf8")
  const saveProfileActionSource = actionsSource.match(
    /export async function saveProfileAction[\s\S]*?revalidatePath\("\/settings\/business"\)\n  return \{ success: true \}\n\}/
  )

  assert.ok(saveProfileActionSource, "No se ha podido localizar saveProfileAction")
  assert.match(saveProfileActionSource[0], /require(SettingsAdmin|CurrentOrganizationId)/)
  assert.match(saveProfileActionSource[0], /buildStaticAssetUrl/)
  assert.doesNotMatch(saveProfileActionSource[0], /path\.basename\(uploadedAvatarPath\)/)
  assert.doesNotMatch(saveProfileActionSource[0], /path\.basename\(uploadedBusinessLogoPath\)/)
})
