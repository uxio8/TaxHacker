"use server"

import { getCurrentUser } from "@/lib/auth"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import { closeFiscalPeriod, reopenFiscalPeriod } from "@/models/fiscal/close"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isRedirectError } from "next/dist/client/components/redirect-error"

function readRequiredFormValue(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName)

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} es obligatorio`)
  }

  return value.trim()
}

function buildCloseRedirectUrl(
  action: "closed" | "reopened" | "error",
  period: string,
  message?: string
) {
  const searchParams = new URLSearchParams({
    action,
    period,
  })

  if (message) {
    searchParams.set("message", message)
  }

  return `/tax/close?${searchParams.toString()}`
}

function buildSuccessMessage(action: "closed" | "reopened", periodKey: string): string {
  if (action === "closed") {
    return `Periodo ${periodKey} cerrado. Los cambios fiscales que alteren asignacion o importes quedan bloqueados hasta su reapertura explicita.`
  }

  return `Periodo ${periodKey} reabierto. Ya se permiten ajustes fiscales sobre ese trimestre.`
}

function revalidateFiscalClosePaths(periodKey: string) {
  const encodedPeriodKey = encodeURIComponent(periodKey)
  const paths = [
    "/tax",
    "/tax/close",
    "/tax/quarters",
    `/tax/quarters/${encodedPeriodKey}`,
    "/tax/archive",
    `/tax/archive/${encodedPeriodKey}`,
    "/tax/forms",
    "/tax/forms/303",
    "/tax/forms/115",
  ]

  for (const path of paths) {
    revalidatePath(path)
  }
}

export async function closeFiscalPeriodAction(formData: FormData) {
  const periodKey = readRequiredFormValue(formData, "periodKey")
  const user = await getCurrentUser()
  const organizationId = await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    redirect(buildCloseRedirectUrl("error", periodKey, "Faltan las migraciones del modulo fiscal"))
  }

  if (fiscalProfileAccess.status !== "ready") {
    redirect(buildCloseRedirectUrl("error", periodKey, "Hace falta un perfil fiscal"))
  }

  let redirectUrl = buildCloseRedirectUrl("closed", periodKey, buildSuccessMessage("closed", periodKey))

  try {
    await closeFiscalPeriod({
      ownerScopeId: fiscalProfileAccess.profile.id,
      fiscalProfile: {
        id: fiscalProfileAccess.profile.id,
        companyName: fiscalProfileAccess.profile.companyName,
        taxId: fiscalProfileAccess.profile.taxId,
      },
      periodKey,
    })

    revalidateFiscalClosePaths(periodKey)
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    redirectUrl = buildCloseRedirectUrl(
      "error",
      periodKey,
      isFiscalStorageNotReadyError(error)
        ? "Faltan las migraciones del modulo fiscal"
        : error instanceof Error
          ? error.message
          : "Error desconocido"
    )
  }

  redirect(redirectUrl)
}

export async function reopenFiscalPeriodAction(formData: FormData) {
  const periodKey = readRequiredFormValue(formData, "periodKey")
  const reason = readRequiredFormValue(formData, "reason")
  const user = await getCurrentUser()
  const organizationId = await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    redirect(buildCloseRedirectUrl("error", periodKey, "Faltan las migraciones del modulo fiscal"))
  }

  if (fiscalProfileAccess.status !== "ready") {
    redirect(buildCloseRedirectUrl("error", periodKey, "Hace falta un perfil fiscal"))
  }

  let redirectUrl = buildCloseRedirectUrl(
    "reopened",
    periodKey,
    buildSuccessMessage("reopened", periodKey)
  )

  try {
    await reopenFiscalPeriod({
      ownerScopeId: fiscalProfileAccess.profile.id,
      fiscalProfile: {
        id: fiscalProfileAccess.profile.id,
        companyName: fiscalProfileAccess.profile.companyName,
        taxId: fiscalProfileAccess.profile.taxId,
      },
      periodKey,
      reason,
    })

    revalidateFiscalClosePaths(periodKey)
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    redirectUrl = buildCloseRedirectUrl(
      "error",
      periodKey,
      isFiscalStorageNotReadyError(error)
        ? "Faltan las migraciones del modulo fiscal"
        : error instanceof Error
          ? error.message
          : "Error desconocido"
    )
  }

  redirect(redirectUrl)
}
