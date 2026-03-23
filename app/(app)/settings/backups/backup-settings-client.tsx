"use client"

import { FormError } from "@/components/forms/error"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useDownload } from "@/hooks/use-download"
import { useI18n } from "@/lib/i18n"
import config from "@/lib/config"
import { useProgress } from "@/hooks/use-progress"
import { Download, Loader2 } from "lucide-react"
import { useActionState } from "react"
import { restoreBackupAction } from "./actions"

export default function BackupSettingsClient() {
  const { t } = useI18n()
  const [restoreState, restoreBackup, restorePending] = useActionState(restoreBackupAction, null)

  const { isLoading, startProgress, progress } = useProgress({
    onError: (error) => {
      console.error("Backup progress error:", error)
    },
  })

  const { download, isDownloading } = useDownload({
    onError: (error) => {
      console.error("Download error:", error)
    },
  })

  const backupCounterLabels: Record<string, string> = {
    "categories.json": t("settings.backups.counters.categories"),
    "currencies.json": t("settings.backups.counters.currencies"),
    "fields.json": t("settings.backups.counters.fields"),
    "files.json": t("settings.backups.counters.files"),
    "projects.json": t("settings.backups.counters.projects"),
    "settings.json": t("settings.backups.counters.settings"),
    "transactions.json": t("settings.backups.counters.transactions"),
    uploadedAttachments: t("settings.backups.counters.uploadedAttachments"),
  }

  const handleDownload = async () => {
    try {
      const progressId = await startProgress("backup")
      const downloadUrl = `/settings/backups/data?progressId=${progressId || ""}`
      await download(downloadUrl, `${config.app.slug}-backup.zip`)
    } catch (error) {
      console.error("Failed to start backup:", error)
    }
  }

  return (
    <div className="container flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("settings.backups.downloadTitle")}</h1>
        <div className="flex flex-row gap-4">
          <Button onClick={handleDownload} disabled={isLoading || isDownloading}>
            {isLoading ? (
              progress?.current ? (
                t("settings.backups.progress.archiving", {
                  current: progress.current,
                  total: progress.total,
                })
              ) : (
                t("settings.backups.progress.preparing")
              )
            ) : isDownloading ? (
              t("settings.backups.progress.downloading")
            ) : (
              <>
                <Download className="mr-2" /> {t("settings.backups.downloadAction")}
              </>
            )}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground max-w-xl">{t("settings.backups.description")}</div>
      </div>

      <Card className="flex flex-col gap-2 mt-16 p-5 bg-red-100 max-w-xl">
        <h2 className="text-xl font-semibold">{t("settings.backups.restoreTitle")}</h2>
        <p className="text-sm text-muted-foreground">⚠️ {t("settings.backups.restoreWarning")}</p>
        <form action={restoreBackup}>
          <div className="flex flex-col gap-4 pt-4">
            <label>
              <input type="file" name="file" required />
            </label>
            <label className="flex flex-row gap-2 items-center">
              <input type="checkbox" name="removeExistingData" required />
              <span className="text-red-500">{t("settings.backups.confirmDeleteExisting")}</span>
            </label>
            <Button type="submit" variant="destructive" disabled={restorePending}>
              {restorePending ? (
                <>
                  <Loader2 className="animate-spin" /> {t("settings.backups.restoring")}
                </>
              ) : (
                t("settings.backups.restoreAction")
              )}
            </Button>
          </div>
        </form>
        {restoreState?.error && <FormError>{restoreState.error}</FormError>}
      </Card>

      {restoreState?.success && (
        <Card className="flex flex-col gap-2 p-5 bg-green-100 max-w-xl">
          <h2 className="text-xl font-semibold">{t("settings.backups.restoredTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.backups.restoredDescription")}</p>
          <ul className="list-disc list-inside">
            {Object.entries(restoreState.data?.counters || {}).map(([key, value]) => (
              <li key={key}>
                <span className="font-bold">{backupCounterLabels[key] || key}</span>:{" "}
                {t("settings.backups.itemsCount", { count: value })}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
