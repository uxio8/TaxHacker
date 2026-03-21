import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import { existsSync, statSync } from "node:fs"
import { registerHooks } from "node:module"
import { pathToFileURL } from "node:url"

const projectRoot = process.cwd()

function resolveAlias(specifier) {
  let target = path.join(projectRoot, specifier.slice(2))

  if (existsSync(target) && statSync(target).isDirectory()) {
    if (existsSync(path.join(target, "index.ts"))) {
      target = path.join(target, "index.ts")
    } else if (existsSync(path.join(target, "index.js"))) {
      target = path.join(target, "index.js")
    }
  } else if (!path.extname(target)) {
    for (const extension of [".ts", ".tsx", ".js", ".mjs"]) {
      if (existsSync(target + extension)) {
        target += extension
        break
      }
    }
  }

  return pathToFileURL(target).href
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(resolveAlias(specifier), context)
    }

    return nextResolve(specifier, context)
  },
})

test("fieldsToJsonSchema includes new billing fields as string properties and item fields", async () => {
  const { fieldsToJsonSchema } = await import("../ai/schema.ts")

  const schema = fieldsToJsonSchema([
    {
      code: "invoice_number",
      type: "string",
      llm_prompt: "invoice number or serial number",
    },
    {
      code: "billing_company_name",
      type: "string",
      llm_prompt: "billing company legal name",
    },
    {
      code: "billing_tax_id",
      type: "string",
      llm_prompt: "billing tax id or VAT number",
    },
  ])

  assert.equal(schema.properties.invoice_number.type, "string")
  assert.equal(schema.properties.billing_company_name.type, "string")
  assert.equal(schema.properties.billing_tax_id.type, "string")
  assert.deepEqual(schema.required, ["invoice_number", "billing_company_name", "billing_tax_id", "items"])
  assert.equal(schema.properties.items.items.properties.invoice_number.type, "string")
})
