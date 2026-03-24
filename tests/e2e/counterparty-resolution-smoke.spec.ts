import { expect, test } from "@playwright/test"

import { prisma } from "../../lib/db.ts"
import { loginAsSelfHosted } from "./helpers/auth"
import { seedFiscalSmokeData } from "./helpers/fiscal-smoke-fixture"

test.describe("Smoke detalle fiscal de contraparte", () => {
  let smokeData: Awaited<ReturnType<typeof seedFiscalSmokeData>>

  test.beforeEach(async ({ page }) => {
    smokeData = await seedFiscalSmokeData()
    await loginAsSelfHosted(page)
  })

  test("confirma la sugerencia segura desde el detalle de la transacción", async ({ page }) => {
    await page.goto(`/transactions/${smokeData.reviewTransactionId}`)

    await expect(page.getByText("Panel fiscal").first()).toBeVisible()
    await expect(page.getByText("Resolver contraparte").first()).toBeVisible()
    await expect(page.getByText("Coincidencia exacta por NIF").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Confirmar sugerencia" })).toBeVisible()

    await page.getByRole("button", { name: "Confirmar sugerencia" }).click()

    await expect
      .poll(async () => {
        const document = await prisma.transactionFiscal.findUnique({
          where: { id: smokeData.reviewFiscalDocumentId },
          select: { counterpartyId: true },
        })
        const auditEvent = await prisma.fiscalAuditLog.findFirst({
          where: {
            ownerScopeId: smokeData.ownerScopeId,
            fiscalDocumentId: smokeData.reviewFiscalDocumentId,
            event: "counterparty_confirmed",
          },
          orderBy: {
            createdAt: "desc",
          },
        })

        return JSON.stringify({
          counterpartyId: document?.counterpartyId ?? null,
          auditEvent: auditEvent?.event ?? null,
        })
      })
      .toBe(
        JSON.stringify({
          counterpartyId: smokeData.reviewCounterpartyId,
          auditEvent: "counterparty_confirmed",
        })
      )

    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByText("La evidencia fiscal del documento ya está enlazada con una contraparte canónica.")
    ).toBeVisible()
  })

  test("permite mantener la contraparte en revisión guardando un motivo interno auditable", async ({
    page,
  }) => {
    await page.goto(`/transactions/${smokeData.reviewTransactionId}`)

    await expect(page.getByText("Resolver contraparte").first()).toBeVisible()

    await page
      .getByLabel("Motivo interno (opcional)")
      .first()
      .fill("Se mantiene en revisión hasta validar el soporte definitivo con el cliente.")
    await page.getByRole("button", { name: "Mantener en revisión" }).click()

    await expect
      .poll(async () => {
        const auditEvent = await prisma.fiscalAuditLog.findFirst({
          where: {
            ownerScopeId: smokeData.ownerScopeId,
            fiscalDocumentId: smokeData.reviewFiscalDocumentId,
            event: "counterparty_kept_in_review",
          },
          orderBy: {
            createdAt: "desc",
          },
        })

        const payload =
          auditEvent && auditEvent.payload && typeof auditEvent.payload === "object"
            ? (auditEvent.payload as Record<string, unknown>)
            : null
        const details =
          payload?.details && typeof payload.details === "object"
            ? (payload.details as Record<string, unknown>)
            : null

        return JSON.stringify({
          event: auditEvent?.event ?? null,
          operatorNote:
            typeof details?.operator_note === "string" ? details.operator_note : null,
        })
      })
      .toBe(
        JSON.stringify({
          event: "counterparty_kept_in_review",
          operatorNote: "Se mantiene en revisión hasta validar el soporte definitivo con el cliente.",
        })
      )
  })
})
