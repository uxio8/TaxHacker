import { SelectProps } from "@radix-ui/react-select"
import { useI18n } from "@/lib/i18n"
import { FormSelect } from "./simple"

export const FormSelectType = ({
  title,
  emptyValue,
  placeholder,
  hideIfEmpty = false,
  isRequired = false,
  ...props
}: {
  title: string
  emptyValue?: string
  placeholder?: string
  hideIfEmpty?: boolean
  isRequired?: boolean
} & SelectProps) => {
  const { t } = useI18n()
  const items = [
    { code: "expense", name: t("transactions.type.expense"), badge: "↓" },
    { code: "income", name: t("transactions.type.income"), badge: "↑" },
    { code: "pending", name: t("transactions.type.pending"), badge: "⏲︎" },
    { code: "other", name: t("transactions.type.other"), badge: "?" },
  ]

  return (
    <FormSelect
      title={title}
      items={items}
      emptyValue={emptyValue}
      placeholder={placeholder}
      hideIfEmpty={hideIfEmpty}
      isRequired={isRequired}
      {...props}
    />
  )
}
