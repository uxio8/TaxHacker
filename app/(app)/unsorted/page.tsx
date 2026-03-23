import { FilePreview } from "@/components/files/preview"
import { UploadButton } from "@/components/files/upload-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AnalyzeAllButton } from "@/components/unsorted/analyze-all-button"
import AnalyzeForm from "@/components/unsorted/analyze-form"
import { canAnalyzeFileMimeType } from "@/lib/analysis-support"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createTranslator } from "@/lib/i18n"
import { createPageMetadata } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getCategories } from "@/models/categories"
import { getCurrencies } from "@/models/currencies"
import { getFields } from "@/models/fields"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { getFiscalReviewQueue } from "@/models/fiscal/review-queue"
import { getUnsortedFiles } from "@/models/files"
import { getProjects } from "@/models/projects"
import { getLLMSettings, getSettings } from "@/models/settings"
import { buildUnsortedInboxItems } from "@/models/unsorted-inbox"
import { FileText, PartyPopper, Settings, Upload } from "lucide-react"
import Link from "next/link"

export const metadata = createPageMetadata("common.unsorted", {
  descriptionKey: "unsorted.description",
})

export default async function UnsortedPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const files = await getUnsortedFiles(organizationId)
  const categories = await getCategories(organizationId)
  const projects = await getProjects(organizationId)
  const currencies = await getCurrencies(organizationId)
  const fields = await getFields(organizationId)
  const settings = await getSettings(organizationId)
  const llmSettings = getLLMSettings(settings)
  const analyzableFilesCount = files.filter((file) => !file.isSplitted && canAnalyzeFileMimeType(file.mimetype)).length
  const hasConfiguredLlmProvider = llmSettings.providers.some(
    (provider) => provider.provider === "pool_cloud" || Boolean(provider.apiKey && provider.model)
  )
  const summaries = buildUnsortedInboxItems(files, {
    llmConfigured: hasConfiguredLlmProvider,
  })
  const saveableCount = summaries.filter((summary) => summary.state === "ready_to_review").length
  const deferredToDesktopCount = summaries.filter((summary) => summary.state === "deferred_to_desktop").length
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)
  const openClientReviewRequestCount =
    fiscalProfileAccess.status === "ready"
      ? (await getFiscalReviewQueue(fiscalProfileAccess.profile.id)).items.filter((item) => item.owner === "client")
        .length
      : 0

  return (
    <>
      <header className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("unsorted.title", { count: files.length })}</h2>
        {analyzableFilesCount > 1 && (
          <AnalyzeAllButton
            analyzableCount={analyzableFilesCount}
            llmConfigured={hasConfiguredLlmProvider}
            saveableCount={saveableCount}
          />
        )}
      </header>

      {config.selfHosted.isEnabled && !hasConfiguredLlmProvider && (
          <Alert>
            <Settings className="h-4 w-4 mt-2" />
            <div className="flex flex-row justify-between pt-2">
              <div className="flex flex-col">
                <AlertTitle>{t("unsorted.configureProviders.title")}</AlertTitle>
                <AlertDescription>{t("unsorted.configureProviders.description")}</AlertDescription>
              </div>
              <Button asChild>
                <Link href="/settings/llm">{t("unsorted.configureProviders.open")}</Link>
              </Button>
            </div>
          </Alert>
        )}

      <main className="flex flex-col gap-5">
        {deferredToDesktopCount > 0 ? (
          <Alert>
            <Settings className="h-4 w-4 mt-2" />
            <div className="flex flex-col gap-1 py-2">
              <AlertTitle>Revisiones derivadas desde móvil</AlertTitle>
              <AlertDescription>
                {deferredToDesktopCount} documentos ya vienen marcados para terminarse en escritorio dentro de este mismo
                inbox.
              </AlertDescription>
            </div>
          </Alert>
        ) : null}
        {openClientReviewRequestCount > 0 ? (
          <Alert>
            <Settings className="h-4 w-4 mt-2" />
            <div className="flex flex-col gap-1 py-2">
              <AlertTitle>Hay incidencias fiscales abiertas del cliente</AlertTitle>
              <AlertDescription>
                {openClientReviewRequestCount} incidencias siguen esperando documentación pendiente del cliente. Usa
                este inbox para resolver documentación pendiente y luego vuelve a revisión fiscal para cerrarlas.
              </AlertDescription>
            </div>
          </Alert>
        ) : null}
        {files.map((file, index) => {
          const summary = summaries[index]

          return (
          <Card
            key={`${file.id}:${file.filename}`}
            id={file.id}
            className="flex flex-row flex-wrap md:flex-nowrap justify-center items-start gap-5 p-5 bg-gradient-to-br from-violet-50/80 via-indigo-50/80 to-white border-violet-200/60 rounded-2xl"
          >
            <div className="w-full max-w-[500px]">
              {typeof file.metadata === "object"
              && file.metadata !== null
              && "mobileTriage" in file.metadata
              && typeof file.metadata.mobileTriage === "object"
              && file.metadata.mobileTriage !== null
              && "disposition" in file.metadata.mobileTriage
              && (
                file.metadata.mobileTriage.disposition === "deferred_to_desktop"
                || file.metadata.mobileTriage.disposition === "deferred"
              ) ? (
                <Badge variant="outline" className="mb-3">
                  Revisar en escritorio
                </Badge>
              ) : null}
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
                summary={summary}
              />
            </div>
          </Card>
          )
        })}
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
