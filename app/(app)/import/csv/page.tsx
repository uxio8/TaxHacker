import { ImportCSVTable } from "@/components/import/csv"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata } from "@/lib/i18n"
import { getFields } from "@/models/fields"

export const metadata = createPageMetadata("common.importCsv", {
  descriptionKey: "import.csv.uploadPrompt",
})

export default async function CSVImportPage() {
  const user = await getCurrentUser()
  const fields = await getFields(user.id)
  return (
    <div className="flex flex-col gap-4 p-4">
      <ImportCSVTable fields={fields} />
    </div>
  )
}
