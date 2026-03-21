import { FilePreview } from "@/components/files/preview"
import { UploadButton } from "@/components/files/upload-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AnalyzeAllButton } from "@/components/unsorted/analyze-all-button"
import AnalyzeForm from "@/components/unsorted/analyze-form"
import { canAnalyzeFileMimeType } from "@/lib/analysis-support"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createTranslator } from "@/lib/i18n"
import { createPageMetadata } from "@/lib/i18n"
import { getCategories } from "@/models/categories"
import { getCurrencies } from "@/models/currencies"
import { getFields } from "@/models/fields"
import { getUnsortedFiles } from "@/models/files"
import { getProjects } from "@/models/projects"
import { getLLMSettings, getSettings } from "@/models/settings"
import { FileText, PartyPopper, Settings, Upload } from "lucide-react"
import Link from "next/link"

export const metadata = createPageMetadata("common.unsorted", {
  descriptionKey: "unsorted.description",
})

export default async function UnsortedPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const files = await getUnsortedFiles(user.id)
  const categories = await getCategories(user.id)
  const projects = await getProjects(user.id)
  const currencies = await getCurrencies(user.id)
  const fields = await getFields(user.id)
  const settings = await getSettings(user.id)
  const llmSettings = getLLMSettings(settings)
  const analyzableFilesCount = files.filter((file) => !file.isSplitted && canAnalyzeFileMimeType(file.mimetype)).length
  const hasConfiguredLlmProvider = llmSettings.providers.some(
    (provider) => provider.provider === "pool_cloud" || Boolean(provider.apiKey && provider.model)
  )

  return (
    <>
      <header className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("unsorted.title", { count: files.length })}</h2>
        {analyzableFilesCount > 1 && <AnalyzeAllButton />}
      </header>

      {config.selfHosted.isEnabled && !hasConfiguredLlmProvider && (
          <Alert>
            <Settings className="h-4 w-4 mt-2" />
            <div className="flex flex-row justify-between pt-2">
              <div className="flex flex-col">
                <AlertTitle>{t("unsorted.configureProviders.title")}</AlertTitle>
                <AlertDescription>{t("unsorted.configureProviders.description")}</AlertDescription>
              </div>
              <Link href="/settings/llm">
                <Button>{t("unsorted.configureProviders.open")}</Button>
              </Link>
            </div>
          </Alert>
        )}

      <main className="flex flex-col gap-5">
        {files.map((file) => (
          <Card
            key={file.id}
            id={file.id}
            className="flex flex-row flex-wrap md:flex-nowrap justify-center items-start gap-5 p-5 bg-gradient-to-br from-violet-50/80 via-indigo-50/80 to-white border-violet-200/60 rounded-2xl"
          >
            <div className="w-full max-w-[500px]">
              <Card>
                <FilePreview file={file} />
              </Card>
            </div>

            <div className="w-full">
              <AnalyzeForm
                file={file}
                categories={categories}
                projects={projects}
                currencies={currencies}
                fields={fields}
                settings={settings}
              />
            </div>
          </Card>
        ))}
        {files.length == 0 && (
          <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[600px]">
            <PartyPopper className="w-12 h-12 text-muted-foreground" />
            <p className="pt-4 text-muted-foreground">{t("unsorted.empty.title")}</p>
            <p className="flex flex-row gap-2 text-muted-foreground">
              <span>{t("unsorted.empty.hint")}</span>
              <Upload />
            </p>

            <div className="flex flex-row gap-5 mt-8">
              <UploadButton>
                <Upload /> {t("unsorted.uploadNewFile")}
              </UploadButton>
              <Button variant="outline" asChild>
                <Link href="/transactions">
                  <FileText />
                  {t("unsorted.goToTransactions")}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
