import { addCategoryAction, deleteCategoryAction, editCategoryAction } from "@/app/(app)/settings/actions"
import { CrudTable } from "@/components/settings/crud"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { randomHexColor } from "@/lib/utils"
import { getCategories } from "@/models/categories"
import { Prisma } from "@/prisma/client"

export const metadata = createPageMetadata("common.categories")

export default async function CategoriesSettingsPage() {
  const t = createTranslator()
  const organizationId = await requireCurrentOrganizationId()
  const categories = await getCategories(organizationId)
  const categoriesWithActions = categories.map((category) => ({
    ...category,
    isEditable: true,
    isDeletable: true,
  }))

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-2">{t("settings.categories.title")}</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-prose">{t("settings.categories.description")}</p>

      <CrudTable
        items={categoriesWithActions}
        columns={[
          { key: "name", label: t("settings.columns.name"), editable: true },
          { key: "llm_prompt", label: t("settings.columns.llmPrompt"), editable: true },
          { key: "color", label: t("settings.columns.color"), type: "color", defaultValue: randomHexColor(), editable: true },
        ]}
        onDelete={async (code) => {
          "use server"
          return await deleteCategoryAction(code)
        }}
        onAdd={async (data) => {
          "use server"
          return await addCategoryAction(data as Prisma.CategoryCreateInput)
        }}
        onEdit={async (code, data) => {
          "use server"
          return await editCategoryAction(code, data as Prisma.CategoryUpdateInput)
        }}
      />
    </div>
  )
}
