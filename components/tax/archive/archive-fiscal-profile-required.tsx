import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Translator } from "@/lib/i18n"
import Link from "next/link"

export function ArchiveFiscalProfileRequired({ t }: { t: Translator }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("tax.archive.setup.title")}</CardTitle>
        <CardDescription>{t("tax.archive.setup.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/settings/fiscal">{t("tax.archive.setup.action")}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
