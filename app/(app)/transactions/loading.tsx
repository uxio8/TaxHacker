import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { createTranslator } from "@/lib/i18n"
import { Download, Loader2, Plus } from "lucide-react"

export default function Loading() {
  const t = createTranslator()

  return (
    <>
      <header className="flex items-center justify-between mb-12">
        <h2 className="flex flex-row gap-3 md:gap-5">
          <span className="text-3xl font-bold tracking-tight">{t("transactions.title")}</span>
          <Loader2 className="h-10 w-10 animate-spin" />
        </h2>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download />
            {t("common.actions.export")}
          </Button>
          <Button>
            <Plus /> {t("transactions.addTransaction")}
          </Button>
        </div>
      </header>

      <div className="flex flex-row gap-2 w-full">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>

      <main>
        <div className="flex flex-col gap-3 w-full">
          {[...Array(15)].map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </main>
    </>
  )
}
