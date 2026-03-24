import { expect, test } from "@playwright/test"

import { prisma } from "../../lib/db.ts"
import { loginAsSelfHosted } from "./helpers/auth"
import { seedFiscalSmokeData } from "./helpers/fiscal-smoke-fixture"

test.describe("Smoke fiscal de colaboración", () => {
  let smokeData: Awaited<ReturnType<typeof seedFiscalSmokeData>>

  test.beforeEach(async ({ page }) => {
    smokeData = await seedFiscalSmokeData()
    await loginAsSelfHosted(page)
  })

  test("abre y resuelve una incidencia desde la cola de revisión", async ({ page }) => {
    await page.goto("/tax/review")

    await expect(
      page.locator("main").getByText("Cola de revisión fiscal", { exact: true })
    ).toBeVisible()
    await expect(
      page.locator("main").getByText(smokeData.reviewCounterpartyName, { exact: true }).first()
    ).toBeVisible()
    await expect(page.getByText("Tiene la pelota: Asesoría")).toBeVisible()
    await expect(page.getByText("Obligaciones afectadas")).toBeVisible()

    await page.getByLabel("Fecha límite").fill("2026-04-15")
    await page
      .getByLabel("Qué falta exactamente")
      .fill("Falta validar la contraparte y adjuntar el soporte definitivo.")
    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.request().method() === "POST"
          && response.url().includes("/tax/review")
          && response.status() === 200
        )
      }),
      page.getByRole("button", { name: "Abrir incidencia" }).click(),
    ])

    await expect
      .poll(async () => {
        const request = await prisma.fiscalReviewRequest.findFirst({
          where: {
            fiscalDocumentId: smokeData.reviewFiscalDocumentId,
            status: "open",
          },
          orderBy: {
            createdAt: "desc",
          },
        })

        return JSON.stringify({
          status: request?.status ?? null,
          dueDate: request?.dueDate?.toISOString().slice(0, 10) ?? null,
          message: request?.message ?? null,
        })
      })
      .toBe(
        JSON.stringify({
          status: "open",
          dueDate: "2026-04-15",
          message: "Falta validar la contraparte y adjuntar el soporte definitivo.",
        })
      )

    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("Incidencias abiertas: 1")).toBeVisible()
    await expect(page.getByText("Vence 2026-04-15")).toBeVisible()
    await expect(
      page.getByText("Falta validar la contraparte y adjuntar el soporte definitivo.")
    ).toBeVisible()

    await page.getByRole("button", { name: "Marcar como resuelta" }).click()
    await expect
      .poll(async () => {
        const request = await prisma.fiscalReviewRequest.findFirst({
          where: {
            fiscalDocumentId: smokeData.reviewFiscalDocumentId,
            status: "resolved",
          },
        })

        return request?.status ?? null
      })
      .toBe("resolved")
    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("button", { name: "Marcar como resuelta" })).toHaveCount(0)
  })
})
