"use server"

import {
  categoryFormSchema,
  currencyFormSchema,
  fieldFormSchema,
  projectFormSchema,
  settingsFormSchema,
} from "@/forms/settings"
import { fiscalProfileFormSchema } from "@/forms/fiscal/profile"
import { userFormSchema } from "@/forms/users"
import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId, requireCurrentTenantAdmin } from "@/lib/tenant"
import { buildStaticAssetUrl, uploadStaticImage } from "@/lib/uploads"
import { codeFromName, randomHexColor } from "@/lib/utils"
import { createCategory, deleteCategory, updateCategory } from "@/models/categories"
import { CurrencyData, createCurrency, deleteCurrency, updateCurrency } from "@/models/currencies"
import { createField, deleteField, updateField } from "@/models/fields"
import { syncFiscalObligationsForOrganization } from "@/models/fiscal/obligations"
import { syncDefaultSpanishFiscalPeriodsV1 } from "@/models/fiscal/periods"
import { upsertFiscalProfileForOrganization } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { createProject, deleteProject, updateProject } from "@/models/projects"
import { SettingsMap, updateSettings } from "@/models/settings"
import { updateUser } from "@/models/users"
import { FiscalProfile, Prisma, User } from "@/prisma/client"
import { revalidatePath } from "next/cache"

const t = createTranslator()

async function requireSettingsAdmin(user?: User) {
  const currentUser = user ?? (await getCurrentUser())

  await requireCurrentTenantAdmin({
    getCurrentUser: async () => currentUser,
  })

  return requireCurrentOrganizationId({
    getCurrentUser: async () => currentUser,
  })
}

export async function saveSettingsAction(
  _prevState: ActionState<SettingsMap> | null,
  formData: FormData
): Promise<ActionState<SettingsMap>> {
  const user = await getCurrentUser()
  const organizationId = await requireSettingsAdmin(user)
  const validatedForm = settingsFormSchema.safeParse(Object.fromEntries(formData))

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  for (const key in validatedForm.data) {
    const value = validatedForm.data[key as keyof typeof validatedForm.data]
    if (value !== undefined) {
      await updateSettings(organizationId, key, value)
    }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function saveProfileAction(
  _prevState: ActionState<User> | null,
  formData: FormData
): Promise<ActionState<User>> {
  const user = await getCurrentUser()
  const organizationId = await requireSettingsAdmin(user)
  const validatedForm = userFormSchema.safeParse(Object.fromEntries(formData))

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  // Upload avatar
  let avatarUrl = user.avatar
  const avatarFile = formData.get("avatar") as File | null
  if (avatarFile instanceof File && avatarFile.size > 0) {
    try {
      const uploadedAvatarPath = await uploadStaticImage({
        user,
        organizationId,
        file: avatarFile,
        assetType: "avatar",
        assetId: user.id,
        saveFileName: "avatar.webp",
        maxWidth: 500,
        maxHeight: 500,
      })
      avatarUrl = buildStaticAssetUrl(uploadedAvatarPath)
    } catch (error) {
      return {
        success: false,
        error: t("settings.errors.uploadAvatar", { message: error instanceof Error ? error.message : String(error) }),
      }
    }
  }

  // Upload business logo
  let businessLogoUrl = user.businessLogo
  const businessLogoFile = formData.get("businessLogo") as File | null
  if (businessLogoFile instanceof File && businessLogoFile.size > 0) {
    try {
      const uploadedBusinessLogoPath = await uploadStaticImage({
        user,
        organizationId,
        file: businessLogoFile,
        assetType: "business-logo",
        assetId: "default",
        saveFileName: "businessLogo.png",
        maxWidth: 500,
        maxHeight: 500,
      })
      businessLogoUrl = buildStaticAssetUrl(uploadedBusinessLogoPath)
    } catch (error) {
      return {
        success: false,
        error: t("settings.errors.uploadBusinessLogo", { message: error instanceof Error ? error.message : String(error) }),
      }
    }
  }

  // Update user
  await updateUser(user.id, {
    name: validatedForm.data.name !== undefined ? validatedForm.data.name : user.name,
    avatar: avatarUrl,
    businessAddress:
      validatedForm.data.businessAddress !== undefined ? validatedForm.data.businessAddress : user.businessAddress,
    businessBankDetails:
      validatedForm.data.businessBankDetails !== undefined
        ? validatedForm.data.businessBankDetails
        : user.businessBankDetails,
    businessLogo: businessLogoUrl,
  })

  revalidatePath("/settings/profile")
  revalidatePath("/settings/business")
  return { success: true }
}

export async function saveFiscalProfileAction(
  _prevState: ActionState<FiscalProfile> | null,
  formData: FormData
): Promise<ActionState<FiscalProfile>> {
  const user = await getCurrentUser()
  const organizationId = await requireSettingsAdmin(user)
  const validatedForm = fiscalProfileFormSchema.safeParse(Object.fromEntries(formData))

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.issues[0]?.message ?? validatedForm.error.message }
  }

  try {
    const fiscalProfile = await upsertFiscalProfileForOrganization(
      organizationId,
      user.id,
      validatedForm.data
    )
    await syncDefaultSpanishFiscalPeriodsV1(fiscalProfile.id)
    await syncFiscalObligationsForOrganization(organizationId)
    revalidatePath("/settings/fiscal")
    revalidatePath("/tax/quarters")
    revalidatePath("/tax/close")
    revalidatePath("/tax/archive")
    return { success: true, data: fiscalProfile }
  } catch (error) {
    return {
      success: false,
      error: isFiscalStorageNotReadyError(error)
        ? t("tax.storageNotReady.actionError")
        : error instanceof Error
          ? error.message
          : t("common.errors.generic"),
    }
  }
}

export async function addProjectAction(data: Prisma.ProjectCreateInput) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = projectFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const project = await createProject(organizationId, {
    code: codeFromName(validatedForm.data.name),
    name: validatedForm.data.name,
    llm_prompt: validatedForm.data.llm_prompt || null,
    color: validatedForm.data.color || randomHexColor(),
  })
  revalidatePath("/settings/projects")

  return { success: true, project }
}

export async function editProjectAction(code: string, data: Prisma.ProjectUpdateInput) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = projectFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const project = await updateProject(organizationId, code, {
    name: validatedForm.data.name,
    llm_prompt: validatedForm.data.llm_prompt,
    color: validatedForm.data.color || "",
  })
  revalidatePath("/settings/projects")

  return { success: true, project }
}

export async function deleteProjectAction(code: string) {
  const organizationId = await requireSettingsAdmin()
  try {
    await deleteProject(organizationId, code)
  } catch {
    return { success: false, error: t("settings.errors.deleteProject") }
  }
  revalidatePath("/settings/projects")
  return { success: true }
}

export async function addCurrencyAction(data: CurrencyData) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = currencyFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const currency = await createCurrency(organizationId, {
    code: validatedForm.data.code,
    name: validatedForm.data.name,
  })
  revalidatePath("/settings/currencies")

  return { success: true, currency }
}

export async function editCurrencyAction(code: string, data: { name: string }) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = currencyFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const currency = await updateCurrency(organizationId, code, { name: validatedForm.data.name })
  revalidatePath("/settings/currencies")
  return { success: true, currency }
}

export async function deleteCurrencyAction(code: string) {
  const organizationId = await requireSettingsAdmin()
  try {
    await deleteCurrency(organizationId, code)
  } catch {
    return { success: false, error: t("settings.errors.deleteCurrency") }
  }
  revalidatePath("/settings/currencies")
  return { success: true }
}

export async function addCategoryAction(data: Prisma.CategoryCreateInput) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = categoryFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const code = codeFromName(validatedForm.data.name)
  try {
    const category = await createCategory(organizationId, {
      code,
      name: validatedForm.data.name,
      llm_prompt: validatedForm.data.llm_prompt,
      color: validatedForm.data.color || "",
    })
    revalidatePath("/settings/categories")

    return { success: true, category }
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        error: t("settings.errors.categoryAlreadyExists", { code }),
      }
    }
    return { success: false, error: t("settings.errors.createCategory") }
  }
}

export async function editCategoryAction(code: string, data: Prisma.CategoryUpdateInput) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = categoryFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const category = await updateCategory(organizationId, code, {
    name: validatedForm.data.name,
    llm_prompt: validatedForm.data.llm_prompt,
    color: validatedForm.data.color || "",
  })
  revalidatePath("/settings/categories")

  return { success: true, category }
}

export async function deleteCategoryAction(code: string) {
  const organizationId = await requireSettingsAdmin()
  try {
    await deleteCategory(organizationId, code)
  } catch {
    return { success: false, error: t("settings.errors.deleteCategory") }
  }
  revalidatePath("/settings/categories")
  return { success: true }
}

export async function addFieldAction(data: Prisma.FieldCreateInput) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = fieldFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const field = await createField(organizationId, {
    code: codeFromName(validatedForm.data.name),
    name: validatedForm.data.name,
    type: validatedForm.data.type,
    llm_prompt: validatedForm.data.llm_prompt,
    isVisibleInList: validatedForm.data.isVisibleInList,
    isVisibleInAnalysis: validatedForm.data.isVisibleInAnalysis,
    isRequired: validatedForm.data.isRequired,
    isExtra: true,
  })
  revalidatePath("/settings/fields")

  return { success: true, field }
}

export async function editFieldAction(code: string, data: Prisma.FieldUpdateInput) {
  const organizationId = await requireSettingsAdmin()
  const validatedForm = fieldFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const field = await updateField(organizationId, code, {
    name: validatedForm.data.name,
    type: validatedForm.data.type,
    llm_prompt: validatedForm.data.llm_prompt,
    isVisibleInList: validatedForm.data.isVisibleInList,
    isVisibleInAnalysis: validatedForm.data.isVisibleInAnalysis,
    isRequired: validatedForm.data.isRequired,
  })
  revalidatePath("/settings/fields")

  return { success: true, field }
}

export async function deleteFieldAction(code: string) {
  const organizationId = await requireSettingsAdmin()
  try {
    await deleteField(organizationId, code)
  } catch {
    return { success: false, error: t("settings.errors.deleteField") }
  }
  revalidatePath("/settings/fields")
  return { success: true }
}
