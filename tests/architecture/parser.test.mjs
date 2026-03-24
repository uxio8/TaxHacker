import assert from "node:assert/strict"
import test from "node:test"

import { parseStaticModuleReferences } from "./parser.mjs"

test("parseStaticModuleReferences detecta imports desde, imports laterales y reexports", () => {
  const source = `
    import type { Foo } from "@/models/foo"
    import "@/app/(app)/context"
    export { bar } from "@/lib/bar"
    export type { Baz } from "@/types/baz"
  `

  assert.deepEqual(parseStaticModuleReferences(source), [
    {
      kind: "import",
      isTypeOnly: true,
      specifier: "@/models/foo",
    },
    {
      kind: "import",
      isTypeOnly: false,
      specifier: "@/app/(app)/context",
    },
    {
      kind: "export",
      isTypeOnly: false,
      specifier: "@/lib/bar",
    },
    {
      kind: "export",
      isTypeOnly: true,
      specifier: "@/types/baz",
    },
  ])
})
