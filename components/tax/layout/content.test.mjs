import assert from "node:assert/strict"
import test from "node:test"

import { TAX_WORKSPACE_MODULES, TAX_WORKSPACE_QUICK_LINKS } from "./content.ts"

test("el hub fiscal define los modulos MVP y los accesos rapidos esperados", () => {
  assert.deepEqual(TAX_WORKSPACE_MODULES, [
    {
      id: "quarters",
      href: "/tax/quarters",
      status: "available",
    },
    {
      id: "review",
      href: "/tax/review",
      status: "available",
    },
    {
      id: "forms",
      href: "/tax/forms",
      status: "available",
    },
    {
      id: "archive",
      href: "/tax/archive",
      status: "available",
    },
    {
      id: "close",
      href: "/tax/close",
      status: "available",
    },
  ])

  assert.deepEqual(
    TAX_WORKSPACE_QUICK_LINKS.map((link) => link.href),
    ["/transactions", "/unsorted"]
  )
})
