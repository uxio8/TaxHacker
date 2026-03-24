import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Translator } from "@/lib/i18n"
import type { Counterparty } from "@/prisma/client"
import Link from "next/link"

function getIdentityBasisLabel(t: Translator, counterparty: Counterparty) {
  if (counterparty.identityBasis === "tax_id") {
    return t("tax.counterparties.identity.taxId")
  }

  return t("tax.counterparties.identity.nameFallback")
}

export function CounterpartiesTable({
  counterparties,
  selectedCounterpartyId,
  t,
}: {
  counterparties: Counterparty[]
  selectedCounterpartyId?: string
  t: Translator
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("tax.counterparties.list.title")}</CardTitle>
        <CardDescription>{t("tax.counterparties.list.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tax.counterparties.fields.displayName")}</TableHead>
              <TableHead>{t("tax.counterparties.fields.taxId")}</TableHead>
              <TableHead>{t("tax.counterparties.fields.countryCode")}</TableHead>
              <TableHead>{t("tax.counterparties.fields.isActive")}</TableHead>
              <TableHead>{t("tax.counterparties.fields.identityBasis")}</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">{t("settings.crud.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {counterparties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {t("tax.counterparties.list.empty")}
                </TableCell>
              </TableRow>
            ) : (
              counterparties.map((counterparty) => (
                <TableRow
                  key={counterparty.id}
                  className={counterparty.id === selectedCounterpartyId ? "bg-muted/40" : undefined}
                >
                  <TableCell className="font-medium">{counterparty.displayName}</TableCell>
                  <TableCell>{counterparty.taxId ?? t("tax.counterparties.taxIdMissing")}</TableCell>
                  <TableCell>{counterparty.countryCode}</TableCell>
                  <TableCell>
                    <Badge variant={counterparty.isActive ? "secondary" : "outline"}>
                      {counterparty.isActive ? t("tax.counterparties.status.active") : t("tax.counterparties.status.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getIdentityBasisLabel(t, counterparty)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/tax/counterparties?edit=${counterparty.id}`}>
                        {t("settings.crud.editItem", { item: t("tax.counterparties.singular") })}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
