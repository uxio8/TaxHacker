import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { getTransactionById } from "@/models/transactions"
import { notFound } from "next/navigation"

export const metadata = createPageMetadata("transactions.details")

export default async function TransactionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ transactionId: string }>
}) {
  const t = createTranslator()
  const { transactionId } = await params
  const user = await getCurrentUser()
  const transaction = await getTransactionById(transactionId, user.id)

  if (!transaction) {
    notFound()
  }

  return (
    <>
      <header className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("transactions.details")}</h2>
      </header>
      <main>
        <div className="flex flex-1 flex-col gap-4 pt-0">{children}</div>
      </main>
    </>
  )
}
