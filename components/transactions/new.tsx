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
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getCategories } from "@/models/categories"
import { getCurrencies } from "@/models/currencies"
import { getProjects } from "@/models/projects"
import { getSettings } from "@/models/settings"
import { buttonVariants, type ButtonProps } from "../ui/button"
import TransactionCreateForm from "./create"

export async function NewTransactionDialog({
  children,
  triggerVariant,
}: {
  children: React.ReactNode
  triggerVariant?: ButtonProps["variant"]
}) {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const categories = await getCategories(organizationId)
  const currencies = await getCurrencies(organizationId)
  const settings = await getSettings(organizationId)
  const projects = await getProjects(organizationId)

  return (
    <Dialog>
      <DialogTrigger className={buttonVariants({ variant: triggerVariant })}>{children}</DialogTrigger>
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
