const UPLOAD_DESTINATION = {
  UNSORTED: "unsorted",
  TRANSACTION: "transaction",
} as const

export type UploadDestination = (typeof UPLOAD_DESTINATION)[keyof typeof UPLOAD_DESTINATION]

type GetUploadFlowStateOptions = {
  currentPath?: string | null
  destination: UploadDestination
}

export function getUploadFlowState({ currentPath, destination }: GetUploadFlowStateOptions) {
  if (destination === UPLOAD_DESTINATION.TRANSACTION) {
    return {
      notificationCode: "sidebar.transactions",
      redirectPath: null,
      shouldRefresh: Boolean(currentPath?.startsWith("/transactions")),
    }
  }

  const isAlreadyOnUnsorted = currentPath === "/unsorted"

  return {
    notificationCode: "sidebar.unsorted",
    redirectPath: isAlreadyOnUnsorted ? null : "/unsorted",
    shouldRefresh: isAlreadyOnUnsorted,
  }
}

export function resetFileInputValue(input: { value: string } | null | undefined) {
  if (!input) {
    return
  }

  input.value = ""
}
