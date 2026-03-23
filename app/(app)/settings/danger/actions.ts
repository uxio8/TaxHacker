"use server"

import { prisma } from "@/lib/db"
import { requireCurrentOrganizationId, requireCurrentTenantAdmin } from "@/lib/tenant"
import { DEFAULT_CATEGORIES, DEFAULT_CURRENCIES, DEFAULT_FIELDS, DEFAULT_SETTINGS } from "@/models/defaults"
import { buildOrganizationOwnedCodeWhere, buildOrganizationOwnedCreateData, buildOrganizationOwnedScope } from "@/models/organization-owned"
import { redirect } from "next/navigation"

export async function resetLLMSettings() {
  await requireCurrentTenantAdmin()
  const organizationId = await requireCurrentOrganizationId()
  const llmSettings = DEFAULT_SETTINGS.filter((setting) => setting.code === "prompt_analyse_new_file")

  for (const setting of llmSettings) {
    await prisma.setting.upsert({
      where: buildOrganizationOwnedCodeWhere(organizationId, setting.code),
      update: { value: setting.value },
      create: buildOrganizationOwnedCreateData(organizationId, setting),
    })
  }

  redirect("/settings/llm")
}

export async function resetFieldsAndCategories() {
  await requireCurrentTenantAdmin()
  const organizationId = await requireCurrentOrganizationId()
  // Reset categories
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: buildOrganizationOwnedCodeWhere(organizationId, category.code),
      update: { name: category.name, color: category.color, llm_prompt: category.llm_prompt, createdAt: new Date() },
      create: buildOrganizationOwnedCreateData(organizationId, { ...category, createdAt: new Date() }),
    })
  }
  await prisma.category.deleteMany({
    where: { ...buildOrganizationOwnedScope(organizationId), code: { notIn: DEFAULT_CATEGORIES.map((category) => category.code) } },
  })

  // Reset currencies
  for (const currency of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({
      where: buildOrganizationOwnedCodeWhere(organizationId, currency.code),
      update: { name: currency.name },
      create: buildOrganizationOwnedCreateData(organizationId, currency),
    })
  }
  await prisma.currency.deleteMany({
    where: { ...buildOrganizationOwnedScope(organizationId), code: { notIn: DEFAULT_CURRENCIES.map((currency) => currency.code) } },
  })

  // Reset fields
  for (const field of DEFAULT_FIELDS) {
    await prisma.field.upsert({
      where: buildOrganizationOwnedCodeWhere(organizationId, field.code),
      update: {
        name: field.name,
        type: field.type,
        llm_prompt: field.llm_prompt,
        createdAt: new Date(),
        isVisibleInList: field.isVisibleInList,
        isVisibleInAnalysis: field.isVisibleInAnalysis,
        isRequired: field.isRequired,
        isExtra: field.isExtra,
      },
      create: buildOrganizationOwnedCreateData(organizationId, { ...field, createdAt: new Date() }),
    })
  }
  await prisma.field.deleteMany({
    where: { ...buildOrganizationOwnedScope(organizationId), code: { notIn: DEFAULT_FIELDS.map((field) => field.code) } },
  })

  redirect("/settings/fields")
}
