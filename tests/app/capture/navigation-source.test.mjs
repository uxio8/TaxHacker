import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("el menu movil da acceso visible al canal capture", async () => {
  const source = await readFile(path.resolve(process.cwd(), "components/sidebar/mobile-menu.tsx"), "utf8")

  assert.match(source, /href="\/capture"/)
  assert.match(source, /common\.capture/)
})

test("unsorted muestra badge cuando el archivo se ha diferido a escritorio desde movil", async () => {
  const source = await readFile(path.resolve(process.cwd(), "app/(app)/unsorted/page.tsx"), "utf8")

  assert.match(source, /metadata\.mobileTriage/)
  assert.match(source, /deferred_to_desktop/)
  assert.match(source, /Badge/)
})
