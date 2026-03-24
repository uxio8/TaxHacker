import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AttentionSummary } from "@/lib/attention-contract"
import Link from "next/link"

export function AttentionCenter({ summary }: { summary: AttentionSummary }) {
  if (summary.items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Operación diaria
          </Badge>
          <CardTitle>Todo bajo control</CardTitle>
          <CardDescription>No hay bloqueos ni trabajo prioritario pendiente ahora mismo.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const [primaryItem, ...secondaryItems] = summary.items

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <Badge variant="secondary" className="w-fit">
          Qué requiere atención ahora
        </Badge>
        <div className="space-y-2">
          <CardTitle>{primaryItem.title}</CardTitle>
          <CardDescription>{primaryItem.description}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={primaryItem.state === "blocked" ? "destructive" : "outline"}>
                {primaryItem.state === "blocked" ? "Bloqueado" : "Pendiente"}
              </Badge>
              <span className="text-sm text-muted-foreground">{primaryItem.count} en foco</span>
            </div>
            <p className="text-sm text-muted-foreground">{primaryItem.description}</p>
          </div>
          <Button asChild>
            <Link href={primaryItem.href}>{primaryItem.nextActionLabel}</Link>
          </Button>
        </div>

        {secondaryItems.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {secondaryItems.map((item) => (
              <article key={item.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href={item.href}>{item.nextActionLabel}</Link>
                </Button>
              </article>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
