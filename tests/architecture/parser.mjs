const importFromPattern = /^\s*import\s+(type\s+)?(?:[\w*\s{},$]+)\s+from\s+["']([^"']+)["']/gmu
const sideEffectImportPattern = /^\s*import\s+["']([^"']+)["']/gmu
const exportFromPattern = /^\s*export\s+(type\s+)?(?:\*|\*\s+as\s+[A-Za-z_$][\w$]*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/gmu

export function parseStaticModuleReferences(source) {
  const references = []

  for (const match of source.matchAll(importFromPattern)) {
    references.push({
      kind: "import",
      isTypeOnly: Boolean(match[1]),
      specifier: match[2],
    })
  }

  for (const match of source.matchAll(sideEffectImportPattern)) {
    references.push({
      kind: "import",
      isTypeOnly: false,
      specifier: match[1],
    })
  }

  for (const match of source.matchAll(exportFromPattern)) {
    references.push({
      kind: "export",
      isTypeOnly: Boolean(match[1]),
      specifier: match[2],
    })
  }

  return references
}
