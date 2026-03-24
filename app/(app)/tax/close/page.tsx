import { ClosePeriodsPanel } from "@/components/tax/close/close-periods-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { listQuarterlyDrafts } from "@/models/fiscal/quarterly-draft"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import Link from "next/link"

export const metadata = createPageMetadata("tax.close.meta.title", {
  descriptionKey: "tax.close.meta.description",
})

function readSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function readCloseAction(
  value: string | string[] | undefined
): "closed" | "reopened" | "error" | null {
  const action = readSearchParam(value)

  if (action === "closed" || action === "reopened" || action === "error") {
    return action
  }

  return null
}

export default async function TaxClosePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = createTranslator()
  const params = await searchParams
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.close.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.close.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.close.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (fiscalProfileAccess.status !== "ready") {
    return (
      <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.close.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.close.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.close.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.review.setup.title")}</CardTitle>
            <CardDescription>{t("tax.review.setup.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/fiscal">{t("tax.review.setup.action")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  let drafts

  try {
    drafts = await listQuarterlyDrafts(fiscalProfileAccess.profile.id)
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
          <Card className="shadow-sm">
            <CardHeader className="gap-3">
              <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("tax.close.eyebrow")}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-tight">{t("tax.close.title")}</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  {t("tax.close.description")}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }
  const feedback = {
    action: readCloseAction(params.action),
    message: readSearchParam(params.message),
    period: readSearchParam(params.period),
  }

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <ClosePeriodsPanel
        drafts={drafts}
        feedback={feedback}
        profileName={fiscalProfileAccess.profile.companyName}
        profileTaxId={fiscalProfileAccess.profile.taxId}
        t={t}
      />
    </main>
  )
}
