"use server"

import { saveFileAsTransactionAction, startAnalysisJobAction } from "@/app/(app)/unsorted/actions"
import { getCurrentUser } from "@/lib/auth"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import { getCategories } from "@/models/categories"
import { getFields } from "@/models/fields"
import { getFileById, updateFile } from "@/models/files"
import { getProjects } from "@/models/projects"
import { getSettings } from "@/models/settings"
import { createMobileReviewActions } from "./review-actions-core"
import { revalidatePath } from "next/cache"

type StartAnalysisJobActionParams = Parameters<typeof startAnalysisJobAction>
type SaveFileAsTransactionActionParams = Parameters<typeof saveFileAsTransactionAction>

const mobileReviewActions = createMobileReviewActions({
  getCurrentUser,
  getCurrentOrganizationId: requireCurrentWritableOrganizationId,
  getFileById,
  updateFile,
  getSettings,
  getFields,
  getCategories,
  getProjects,
  startAnalysisJobAction: (file, settings, fields, categories, projects) =>
    startAnalysisJobAction(
      file as StartAnalysisJobActionParams[0],
      settings as StartAnalysisJobActionParams[1],
      fields as StartAnalysisJobActionParams[2],
      categories as StartAnalysisJobActionParams[3],
      projects as StartAnalysisJobActionParams[4]
    ),
  saveFileAsTransactionAction: (prevState, formData) =>
    saveFileAsTransactionAction(prevState as SaveFileAsTransactionActionParams[0], formData),
  revalidatePath,
})

function normalizeActionResult<T extends { success: boolean; error?: string | null }>(result: T) {
  return {
    ...result,
    ...(result.error ? { error: result.error } : {}),
  }
}

export async function acceptMobileReviewAction(...args: Parameters<typeof mobileReviewActions.acceptMobileReviewAction>) {
  return normalizeActionResult(await mobileReviewActions.acceptMobileReviewAction(...args))
}

export async function retryMobileReviewAction(...args: Parameters<typeof mobileReviewActions.retryMobileReviewAction>) {
  return normalizeActionResult(await mobileReviewActions.retryMobileReviewAction(...args))
}

export async function deferMobileReviewAction(...args: Parameters<typeof mobileReviewActions.deferMobileReviewAction>) {
  return normalizeActionResult(await mobileReviewActions.deferMobileReviewAction(...args))
}
