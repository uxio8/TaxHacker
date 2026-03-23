import type { Category, Field, Project } from "@/prisma/client"

export type UserBusinessContext = {
  businessName?: string | null
  businessAddress?: string | null
  businessTaxId?: string | null
}

function buildBillingDisambiguationPrompt(context?: UserBusinessContext) {
  const businessName = context?.businessName?.trim()
  const businessAddress = context?.businessAddress?.trim()
  const businessTaxId = context?.businessTaxId?.trim()
  const ownBusinessLines = [
    businessName && `- businessName: ${businessName}`,
    businessAddress && `- businessAddress: ${businessAddress}`,
    businessTaxId && `- businessTaxId: ${businessTaxId}`,
  ]
    .filter(Boolean)
    .join("\n")

  let prompt = `

SEMANTICA DE FACTURA:
- Los campos billing_* representan siempre a la empresa emisora, proveedora o vendedora de la factura.
- Nunca uses para billing_* a la empresa receptora, cliente facturado o pagador.
`

  if (!ownBusinessLines) {
    return prompt.trim()
  }

  prompt += `
- Datos de nuestra empresa para desambiguar (si aparecen en la factura, suelen corresponder al receptor):
${ownBusinessLines}
- Si esos datos aparecen en la factura, trátalos como datos del receptor o cliente, no como billing_*.
- Si aparece el identificador fiscal de nuestra empresa (NIF/CIF/VAT ID), pertenece al receptor o cliente y no debe poblar ningún campo billing_*.
`

  return prompt.trim()
}

export function buildLLMPrompt(
  promptTemplate: string,
  fields: Field[],
  categories: Category[] = [],
  projects: Project[] = [],
  userBusinessContext?: UserBusinessContext
) {
  let prompt = promptTemplate

  prompt = prompt.replace(
    "{fields}",
    fields
      .filter((field) => field.llm_prompt)
      .map((field) => `- ${field.code}: ${field.llm_prompt}`)
      .join("\n")
  )

  prompt = prompt.replace(
    "{categories}",
    categories
      .filter((category) => category.llm_prompt)
      .map((category) => `- ${category.code}: for ${category.llm_prompt}`)
      .join("\n")
  )

  prompt = prompt.replace(
    "{projects}",
    projects
      .filter((project) => project.llm_prompt)
      .map((project) => `- ${project.code}: for ${project.llm_prompt}`)
      .join("\n")
  )

  prompt = prompt.replace("{categories.code}", categories.map((category) => `${category.code}`).join(", "))
  prompt = prompt.replace("{projects.code}", projects.map((project) => `${project.code}`).join(", "))

  return `${prompt.trim()}\n\n${buildBillingDisambiguationPrompt(userBusinessContext)}`
}
