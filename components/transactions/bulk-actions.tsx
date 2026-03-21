"use client"

import { bulkDeleteTransactionsAction } from "@/app/(app)/transactions/actions"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { Trash2 } from "lucide-react"
import { useState } from "react"

interface BulkActionsMenuProps {
  selectedIds: string[]
  onActionComplete?: () => void
}

export function BulkActionsMenu({ selectedIds, onActionComplete }: BulkActionsMenuProps) {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    const confirmMessage = t("transactions.bulkDeleteConfirm")
    if (!confirm(confirmMessage)) return

    try {
      setIsLoading(true)
      const result = await bulkDeleteTransactionsAction(selectedIds)
      if (!result.success) {
        throw new Error(result.error)
      }
      onActionComplete?.()
    } catch (error) {
      console.error("Failed to delete transactions:", error)
      alert(`Failed to delete transactions: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button variant="destructive" className="min-w-48 gap-2" disabled={isLoading} onClick={handleDelete}>
        <Trash2 className="h-4 w-4" />
        {t("transactions.bulkDeleteSelected", { count: selectedIds.length })}
      </Button>
    </div>
  )
}
