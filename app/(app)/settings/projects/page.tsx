import { addProjectAction, deleteProjectAction, editProjectAction } from "@/app/(app)/settings/actions"
import { CrudTable } from "@/components/settings/crud"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { randomHexColor } from "@/lib/utils"
import { getProjects } from "@/models/projects"
import { Prisma } from "@/prisma/client"

export const metadata = createPageMetadata("common.projects")

export default async function ProjectsSettingsPage() {
  const t = createTranslator()
  const organizationId = await requireCurrentOrganizationId()
  const projects = await getProjects(organizationId)
  const projectsWithActions = projects.map((project) => ({
    ...project,
    isEditable: true,
    isDeletable: true,
  }))

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-2">{t("settings.projects.title")}</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-prose">{t("settings.projects.description")}</p>
      <CrudTable
        items={projectsWithActions}
        columns={[
          { key: "name", label: t("settings.columns.name"), editable: true },
          { key: "llm_prompt", label: t("settings.columns.llmPrompt"), editable: true },
          { key: "color", label: t("settings.columns.color"), type: "color", defaultValue: randomHexColor(), editable: true },
        ]}
        onDelete={async (code) => {
          "use server"
          return await deleteProjectAction(code)
        }}
        onAdd={async (data) => {
          "use server"
          return await addProjectAction(data as Prisma.ProjectCreateInput)
        }}
        onEdit={async (code, data) => {
          "use server"
          return await editProjectAction(code, data as Prisma.ProjectUpdateInput)
        }}
      />
    </div>
  )
}
