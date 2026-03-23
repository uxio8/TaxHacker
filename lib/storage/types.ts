export type StorageObjectKind = "unsorted" | "transaction" | "preview" | "static"

export type StoragePutInput = {
  ownerOrganizationId: string
  objectKey: string
  kind: StorageObjectKind
  contentType: string | null
  body: Buffer | Uint8Array | string
}

export type StorageObjectRef = {
  ownerOrganizationId: string
  objectKey: string
}

export type StorageObject = StorageObjectRef & {
  kind: StorageObjectKind
  contentType: string | null
  size: number
}

export type StorageGetResult = StorageObject & {
  body: Buffer
}

export type StorageCopyInput = {
  ownerOrganizationId: string
  fromObjectKey: string
  toObjectKey: string
}

export type StorageListInput = {
  ownerOrganizationId: string
  prefix: string
}

export type StoragePathDownloadHandle = StorageObjectRef & {
  kind: "path"
  absolutePath: string
  disposition: "inline" | "attachment"
}

export type StorageBufferDownloadHandle = Omit<StorageGetResult, "kind"> & {
  kind: "buffer"
  disposition: "inline" | "attachment"
}

export type StorageDownloadHandle = StoragePathDownloadHandle | StorageBufferDownloadHandle

export interface StorageProvider {
  kind: "local" | "s3"
  put(input: StoragePutInput): Promise<StorageObject>
  get(input: StorageObjectRef): Promise<StorageGetResult | null>
  exists(input: StorageObjectRef): Promise<boolean>
  delete(input: StorageObjectRef): Promise<boolean>
  copy(input: StorageCopyInput): Promise<StorageObject | null>
  move(input: StorageCopyInput): Promise<StorageObject | null>
  list(input: StorageListInput): Promise<StorageObject[]>
  openDownload(
    input: StorageObjectRef & {
      disposition: "inline" | "attachment"
    }
  ): Promise<StorageDownloadHandle | null>
}

export function getOrganizationStoragePrefix(ownerOrganizationId: string) {
  return `organizations/${ownerOrganizationId}`
}

export function assertObjectKeyBelongsToOrganization(ownerOrganizationId: string, objectKey: string) {
  const expectedPrefix = `${getOrganizationStoragePrefix(ownerOrganizationId)}/`

  if (!objectKey.startsWith(expectedPrefix)) {
    throw new Error("Object key must stay inside the organization namespace")
  }
}

export function inferStorageObjectKind(objectKey: string): StorageObjectKind {
  if (objectKey.includes("/uploads/unsorted/")) {
    return "unsorted"
  }

  if (objectKey.includes("/uploads/transactions/")) {
    return "transaction"
  }

  if (objectKey.includes("/derived/previews/")) {
    return "preview"
  }

  return "static"
}
