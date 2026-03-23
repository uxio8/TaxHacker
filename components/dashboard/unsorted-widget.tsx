"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAnalyzedDocumentTitle } from "@/lib/analyzed-file-name"
import { useI18n } from "@/lib/i18n"
import type { UnsortedInboxSummary } from "@/models/unsorted-inbox"
import { File } from "@/prisma/client"
import { Cake, FilePlus } from "lucide-react"
import Link from "next/link"

export default function DashboardUnsortedWidget({
  files,
  summaries,
}: {
  files: File[]
  summaries: UnsortedInboxSummary[]
}) {
  const { t } = useI18n()
  const deferredCount = summaries.filter((summary) => summary.state === "deferred_to_desktop").length

  return (
    <Card className="w-full h-full sm:max-w-xs bg-accent">
      <CardHeader>
        <CardTitle>
          <Link href="/unsorted">
            {files.length > 0 ? t("dashboard.unsorted.withCount", { count: files.length }) : t("dashboard.unsorted.empty")}{" "}
            &rarr;
          </Link>
        </CardTitle>
        {deferredCount > 0 ? (
          <p className="text-sm text-muted-foreground">{deferredCount} vienen de móvil y esperan escritorio.</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {files.slice(0, 3).map((file, index) => {
            const summary = summaries[index]

            return (
            <Link
              href={`/unsorted/#${file.id}`}
              key={file.id}
              className="rounded-md p-2 bg-background hover:bg-black hover:text-white"
            >
              <div className="flex flex-row gap-2">
                <FilePlus className="w-8 h-8" />
                <div className="grid flex-1 text-left leading-tight">
                  {summary?.state === "deferred_to_desktop" ? (
                    <Badge variant="outline" className="mb-1 w-fit">
                      Escritorio
                    </Badge>
                  ) : null}
                  <span className="truncate text-xs font-semibold">
                    {getAnalyzedDocumentTitle(file.filename, file.cachedParseResult as Record<string, unknown> | null | undefined)}
                  </span>
                  <span className="truncate text-xs">{file.mimetype}</span>
                </div>
              </div>
            </Link>
            )
          })}
          {files.length == 0 && (
            <div className="flex flex-col items-center justify-center gap-2 text-sm h-full min-h-[100px] opacity-30">
              <Cake className="w-8 h-8" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
