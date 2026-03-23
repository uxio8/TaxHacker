import { prisma } from "@/lib/db"
import { codeFromName } from "@/lib/utils"
import { formatDate } from "date-fns"
import { createCategory, getCategoryByCode } from "./categories"
import { buildOrganizationOwnedScope } from "./organization-owned"
import { createProject, getProjectByCode } from "./projects"
import { TransactionFilters } from "./transactions"

export type ExportFilters = TransactionFilters

export type ExportFields = string[]

export type ExportImportFieldSettings = {
  code: string
  type: string
  export?: (organizationId: string, value: unknown) => Promise<unknown>
  import?: (organizationId: string, value: unknown) => Promise<unknown>
}

export const EXPORT_AND_IMPORT_FIELD_MAP: Record<string, ExportImportFieldSettings> = {
  name: {
    code: "name",
    type: "string",
  },
  description: {
    code: "description",
    type: "string",
  },
  merchant: {
    code: "merchant",
    type: "string",
  },
  total: {
    code: "total",
    type: "number",
    export: async function (_organizationId: string, value: unknown) {
      return typeof value === "number" ? value / 100 : 0
    },
    import: async function (_organizationId: string, value: unknown) {
      const rawValue = typeof value === "string" ? value : ""
      const num = parseFloat(rawValue)
      return isNaN(num) ? 0.0 : num * 100
    },
  },
  currencyCode: {
    code: "currencyCode",
    type: "string",
  },
  convertedTotal: {
    code: "convertedTotal",
    type: "number",
    export: async function (_organizationId: string, value: unknown) {
      if (typeof value !== "number" || !value) {
        return null
      }

      return value / 100
    },
    import: async function (_organizationId: string, value: unknown) {
      const rawValue = typeof value === "string" ? value : ""
      const num = parseFloat(rawValue)
      return isNaN(num) ? 0.0 : num * 100
    },
  },
  convertedCurrencyCode: {
    code: "convertedCurrencyCode",
    type: "string",
  },
  type: {
    code: "type",
    type: "string",
    export: async function (_organizationId: string, value: unknown) {
      return typeof value === "string" ? value.toLowerCase() : ""
    },
    import: async function (_organizationId: string, value: unknown) {
      return typeof value === "string" ? value.toLowerCase() : ""
    },
  },
  note: {
    code: "note",
    type: "string",
  },
  categoryCode: {
    code: "categoryCode",
    type: "string",
    export: async function (organizationId: string, value: unknown) {
      if (typeof value !== "string" || !value) {
        return null
      }

      const category = await getCategoryByCode(organizationId, value)
      return category?.name
    },
    import: async function (organizationId: string, value: unknown) {
      if (typeof value !== "string" || !value) {
        return null
      }

      const category = await importCategory(organizationId, value)
      return category?.code
    },
  },
  projectCode: {
    code: "projectCode",
    type: "string",
    export: async function (organizationId: string, value: unknown) {
      if (typeof value !== "string" || !value) {
        return null
      }

      const project = await getProjectByCode(organizationId, value)
      return project?.name
    },
    import: async function (organizationId: string, value: unknown) {
      if (typeof value !== "string" || !value) {
        return null
      }

      const project = await importProject(organizationId, value)
      return project?.code
    },
  },
  issuedAt: {
    code: "issuedAt",
    type: "date",
    export: async function (_organizationId: string, value: unknown) {
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        return null
      }

      try {
        return formatDate(value, "yyyy-MM-dd")
      } catch {
        return null
      }
    },
    import: async function (_organizationId: string, value: unknown) {
      if (typeof value !== "string" || !value) {
        return null
      }

      try {
        return new Date(value)
      } catch {
        return null
      }
    },
  },
}

export const importProject = async (organizationId: string, name: string) => {
  const code = codeFromName(name)

  const existingProject = await prisma.project.findFirst({
    where: {
      ...buildOrganizationOwnedScope(organizationId),
      OR: [{ code }, { name }],
    },
  })

  if (existingProject) {
    return existingProject
  }

  return await createProject(organizationId, { code, name })
}

export const importCategory = async (organizationId: string, name: string) => {
  const code = codeFromName(name)

  const existingCategory = await prisma.category.findFirst({
    where: {
      ...buildOrganizationOwnedScope(organizationId),
      OR: [{ code }, { name }],
    },
  })

  if (existingCategory) {
    return existingCategory
  }

  return await createCategory(organizationId, { code, name })
}
