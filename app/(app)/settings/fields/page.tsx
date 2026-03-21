import { addFieldAction, deleteFieldAction, editFieldAction } from "@/app/(app)/settings/actions"
import { CrudTable } from "@/components/settings/crud"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { getFields } from "@/models/fields"
import { Prisma } from "@/prisma/client"

export const metadata = createPageMetadata("common.fields")

export default async function FieldsSettingsPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const fields = await getFields(user.id)
  const fieldsWithActions = fields.map((field) => ({
    ...field,
    isEditable: true,
    isDeletable: field.isExtra,
  }))

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-2">{t("settings.fields.title")}</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-prose">{t("settings.fields.description")}</p>
      <CrudTable
        items={fieldsWithActions}
        columns={[
          { key: "name", label: t("settings.columns.name"), editable: true },
          {
            key: "type",
            label: t("settings.columns.type"),
            type: "select",
            options: [
              { value: "string", label: t("settings.fieldTypes.string") },
              { value: "number", label: t("settings.fieldTypes.number") },
              { value: "boolean", label: t("settings.fieldTypes.boolean") },
            ],
            defaultValue: "string",
            editable: true,
          },
          { key: "llm_prompt", label: t("settings.columns.llmPrompt"), editable: true },
          {
            key: "isVisibleInList",
            label: t("settings.columns.showInTransactions"),
            type: "checkbox",
            defaultValue: false,
            editable: true,
          },
          {
            key: "isVisibleInAnalysis",
            label: t("settings.columns.showInAnalysis"),
            type: "checkbox",
            defaultValue: false,
            editable: true,
          },
          {
            key: "isRequired",
            label: t("settings.columns.isRequired"),
            type: "checkbox",
            defaultValue: false,
            editable: true,
          },
        ]}
        onDelete={async (code) => {
          "use server"
          return await deleteFieldAction(user.id, code)
        }}
        onAdd={async (data) => {
          "use server"
          return await addFieldAction(user.id, data as Prisma.FieldCreateInput)
        }}
        onEdit={async (code, data) => {
          "use server"
          return await editFieldAction(user.id, code, data as Prisma.FieldUpdateInput)
        }}
      />
    </div>
  )
}
