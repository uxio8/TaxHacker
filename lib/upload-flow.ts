import type { ActionState } from "./actions"

const UPLOAD_DESTINATION = {
  UNSORTED: "unsorted",
  TRANSACTION: "transaction",
} as const

const DEFAULT_UPLOAD_API_ERROR = "No se ha podido completar la subida de archivos."
const DEFAULT_UPLOAD_NETWORK_ERROR = "No se ha podido conectar con la subida de archivos."

export type UploadDestination = (typeof UPLOAD_DESTINATION)[keyof typeof UPLOAD_DESTINATION]

type GetUploadFlowStateOptions = {
  currentPath?: string | null
  destination: UploadDestination
}

type UploadRequestOptions = {
  files: Iterable<File> | ArrayLike<File>
  transactionId?: string | null
}

type UploadSuccessFlowOptions = {
  currentPath?: string | null
  destination: UploadDestination
  router: {
    push: (href: string) => void
    refresh: () => void
  }
  showNotification: (notification: { code: string; message: string }) => void
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

export function buildUploadFormData({ files, transactionId }: UploadRequestOptions) {
  const formData = new FormData()

  if (transactionId) {
    formData.append("transactionId", transactionId)
  }

  for (const file of Array.from(files)) {
    formData.append("files", file)
  }

  return formData
}

export async function uploadFilesWithHttp({ files, transactionId }: UploadRequestOptions): Promise<ActionState<null>> {
  let response: Response

  try {
    response = await fetch("/api/uploads", {
      method: "POST",
      body: buildUploadFormData({ files, transactionId }),
    })
  } catch {
    throw new Error(DEFAULT_UPLOAD_NETWORK_ERROR)
  }

  const result = await parseUploadResponse(response)

  if (!response.ok) {
    return {
      success: false,
      error: result.error ?? DEFAULT_UPLOAD_API_ERROR,
    }
  }

  return {
    success: Boolean(result.success),
    error: result.error ?? null,
  }
}

export function notifyUploadSuccess({ currentPath, destination, router, showNotification }: UploadSuccessFlowOptions) {
  const uploadFlow = getUploadFlowState({
    currentPath,
    destination,
  })

  showNotification({ code: uploadFlow.notificationCode, message: "new" })
  setTimeout(() => showNotification({ code: uploadFlow.notificationCode, message: "" }), 3000)

  if (uploadFlow.redirectPath) {
    router.push(uploadFlow.redirectPath)
  }

  if (uploadFlow.redirectPath || uploadFlow.shouldRefresh) {
    router.refresh()
  }
}

async function parseUploadResponse(response: Response): Promise<ActionState<null>> {
  try {
    const result = (await response.json()) as ActionState<null>
    return {
      success: Boolean(result.success),
      error: result.error ?? null,
    }
  } catch {
    return {
      success: false,
      error: DEFAULT_UPLOAD_API_ERROR,
    }
  }
}
