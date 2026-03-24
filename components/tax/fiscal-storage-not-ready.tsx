import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Translator } from "@/lib/i18n"

export function FiscalStorageNotReady({ t }: { t: Translator }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("tax.storageNotReady.title")}</CardTitle>
        <CardDescription>{t("tax.storageNotReady.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("tax.storageNotReady.hint")}</p>
      </CardContent>
    </Card>
  )
}
