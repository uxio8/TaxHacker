import { expect, test } from "@playwright/test"

import { prisma } from "../../lib/db.ts"
import { loginAsSelfHosted } from "./helpers/auth"
import { seedFiscalSmokeData } from "./helpers/fiscal-smoke-fixture"

test.describe("Smoke fiscal de obligaciones", () => {
  let smokeData: Awaited<ReturnType<typeof seedFiscalSmokeData>>

  test.beforeEach(async ({ page }) => {
    smokeData = await seedFiscalSmokeData()
    await loginAsSelfHosted(page)
  })

  test("recorre el cockpit fiscal y los borradores reales del tenant", async ({ page }) => {
    await page.goto("/tax")

    await expect(page.locator("main").getByText("Cockpit de obligaciones", { exact: true })).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 303", { exact: true }).first()).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 115", { exact: true }).first()).toBeVisible()
    await expect(
      page.locator("main").getByText("Modelo 111 manual", { exact: true }).first()
    ).toBeVisible()
    await expect(page.locator("main").getByText("Capa anual", { exact: true })).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 390", { exact: true }).first()).toBeVisible()
    await expect(page.locator("main").getByText("Señal operativa", { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Abrir handoff anual" })
    ).toBeVisible()

    await page.goto("/tax/forms")

    await expect(page.locator("main").getByText("Modelos fiscales", { exact: true })).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 303", { exact: true }).last()).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 115", { exact: true }).last()).toBeVisible()
    await expect(
      page.locator("main").getByText("Modelo 111 manual", { exact: true }).last()
    ).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 180", { exact: true }).last()).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 390", { exact: true }).last()).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 347", { exact: true }).last()).toBeVisible()
    await expect(page.locator("main").getByText("Modelo 349", { exact: true })).toHaveCount(0)

    await page.goto("/tax/forms/303?period=2026-Q1")

    await expect(page.getByText("Modelo 303").first()).toBeVisible()
    await expect(page.getByText("Fuente: tenant actual")).toBeVisible()
    await expect(page.getByText("Requiere atención")).toBeVisible()
    await expect(
      page.locator("main").getByText("Documentos del trimestre", { exact: true })
    ).toBeVisible()
    await expect(page.getByText(smokeData.rentInvoiceNumber)).toBeVisible()
    await expect(page.getByText("Expediente de presentación")).toBeVisible()

    await page.getByLabel("Estado operativo").selectOption("ready_to_file")
    await page.getByLabel("Referencia externa / CSV").fill("CSV-SMOKE-303-2026Q1")
    await page.getByLabel("Notas de presentación").fill("Smoke E2E 303 listo para presentar.")
    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.request().method() === "POST"
          && response.url().includes("/tax/forms/303?period=2026-Q1")
          && response.status() === 200
        )
      }),
      page.getByRole("button", { name: "Guardar expediente" }).click(),
    ])
    await expect
      .poll(async () => {
        const obligation = await prisma.fiscalObligation.findUnique({
          where: {
            organizationId_code_periodKey: {
              organizationId: smokeData.organizationId,
              code: "303",
              periodKey: "2026-Q1",
            },
          },
        })
        const dossier = obligation
          ? await prisma.fiscalFilingDossier.findUnique({
              where: { fiscalObligationId: obligation.id },
            })
          : null

        return JSON.stringify({
          status: obligation?.status ?? null,
          filingReference: dossier?.filingReference ?? null,
        })
      })
      .toBe(
        JSON.stringify({
          status: "ready_to_file",
          filingReference: "CSV-SMOKE-303-2026Q1",
        })
      )
    await page.reload()

    await expect(page.getByLabel("Estado operativo")).toHaveValue("ready_to_file")
    await expect(page.getByLabel("Referencia externa / CSV")).toHaveValue("CSV-SMOKE-303-2026Q1")

    await page.goto("/tax/forms/115?period=2026-Q1")

    await expect(page.getByText("Modelo 115").first()).toBeVisible()
    await expect(page.getByText("Tenant real")).toBeVisible()
    await expect(page.getByText(smokeData.rentInvoiceNumber)).toBeVisible()
    await expect(page.getByText("Readiness documental")).toBeVisible()
    await expect(
      page.locator("main").getByText("Documentos incluidos", { exact: true }).first()
    ).toBeVisible()

    await page.goto("/tax/forms/111?period=2026-Q1")

    await expect(page.getByText("Modelo 111 manual").first()).toBeVisible()
    await expect(page.getByText("No está calculado por TaxHacker")).toBeVisible()

    await page.goto("/tax/forms/180?period=2026-Y")

    await expect(page.getByText("Modelo 180").first()).toBeVisible()
    await expect(page.getByText("Documentos incluidos")).toBeVisible()
    await expect(page.getByText("Líneas fuente")).toBeVisible()
    await expect(page.getByText(smokeData.rentInvoiceNumber)).toBeVisible()

    await page.goto("/tax/forms/390?period=2026-Y")

    await expect(page.getByText("Modelo 390").first()).toBeVisible()
    await expect(page.getByText("Readiness documental")).toBeVisible()
    await expect(
      page.locator("main").getByText("Documentos incluidos", { exact: true }).first()
    ).toBeVisible()
    await expect(page.getByText(smokeData.rentInvoiceNumber)).toBeVisible()

    await page.goto("/tax/archive/annual")

    await expect(page.getByText("Cierre anual ligero").first()).toBeVisible()
    await expect(page.getByText("Checklist anual")).toBeVisible()
    await expect(page.getByText("Seguimiento manual", { exact: true })).toBeVisible()
    await expect(
      page.locator("main").getByText("Pagos fraccionados", { exact: true }).first()
    ).toBeVisible()
    await expect(
      page.locator("main").getByText("Impuesto sobre Sociedades", { exact: true }).first()
    ).toBeVisible()
    await expect(
      page.locator("main").getByText("Deposito de cuentas", { exact: true }).first()
    ).toBeVisible()

    const annualPeriodKeyText = await page
      .locator("main")
      .getByText(/^Ejercicio \d{4}-Y$/)
      .first()
      .textContent()
    const annualPeriodKey = annualPeriodKeyText?.replace("Ejercicio", "").trim()

    expect(annualPeriodKey).toBeTruthy()

    const annualItem = page.locator("article").filter({ hasText: "202_handoff" }).first()

    await annualItem.getByLabel("Estado del handoff anual 202_handoff").selectOption("needs_review")
    await annualItem.getByLabel("Responsable anual 202_handoff").selectOption("shared")
    await annualItem
      .getByLabel("Notas internas 202_handoff")
      .fill("Pendiente validar el cierre y el soporte final del pago fraccionado.")
    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.request().method() === "POST"
          && response.url().includes("/tax/archive/annual")
          && response.status() === 200
        )
      }),
      annualItem.getByRole("button", { name: "Guardar seguimiento" }).click(),
    ])

    await expect
      .poll(async () => {
        const obligation = await prisma.fiscalObligation.findUnique({
          where: {
            organizationId_code_periodKey: {
              organizationId: smokeData.organizationId,
              code: "202_handoff",
              periodKey: annualPeriodKey ?? "",
            },
          },
        })

        return JSON.stringify({
          status: obligation?.status ?? null,
          owner: obligation?.owner ?? null,
          notes: obligation?.notes ?? null,
        })
      })
      .toBe(
        JSON.stringify({
          status: "needs_review",
          owner: "shared",
          notes: "Pendiente validar el cierre y el soporte final del pago fraccionado.",
        })
      )
  })
})
