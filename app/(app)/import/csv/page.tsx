import { ImportCSVTable } from "@/components/import/csv"
import { createPageMetadata } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFields } from "@/models/fields"

export const metadata = createPageMetadata("common.importCsv", {
  descriptionKey: "import.csv.uploadPrompt",
})

export default async function CSVImportPage() {
  const organizationId = await requireCurrentOrganizationId()
  const fields = await getFields(organizationId)
  return (
    <div className="flex flex-col gap-4 p-4">
      <ImportCSVTable fields={fields} />
    </div>
  )
}
