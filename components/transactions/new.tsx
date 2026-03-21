import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { getCategories } from "@/models/categories"
import { getCurrencies } from "@/models/currencies"
import { getProjects } from "@/models/projects"
import { getSettings } from "@/models/settings"
import { Button } from "../ui/button"
import TransactionCreateForm from "./create"

export async function NewTransactionDialog({ children }: { children: React.ReactNode }) {
  const t = createTranslator()
  const user = await getCurrentUser()
  const categories = await getCategories(user.id)
  const currencies = await getCurrencies(user.id)
  const settings = await getSettings(user.id)
  const projects = await getProjects(user.id)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{children}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{t("transactions.newTitle")}</DialogTitle>
          <DialogDescription>{t("transactions.newDescription")}</DialogDescription>
        </DialogHeader>

        <TransactionCreateForm
          categories={categories}
          currencies={currencies}
          settings={settings}
          projects={projects}
        />
      </DialogContent>
    </Dialog>
  )
}
