import assert from "node:assert/strict"
import test from "node:test"

const contractModule = await import(new URL("../../../components/capture/mobile-contract.ts", import.meta.url))

test("shouldPollInbox devuelve true mientras exista algun item analizando", () => {
  assert.equal(
    contractModule.shouldPollInbox([
      {
        fileId: "file-1",
        filename: "ticket.jpg",
        previewUrl: "/files/preview/file-1",
        state: "analyzing",
        reasonCode: null,
        confidence: "medium",
        analysisJobId: "job-1",
        updatedAt: new Date().toISOString(),
      },
    ]),
    true
  )

  assert.equal(
    contractModule.shouldPollInbox([
      {
        fileId: "file-2",
        filename: "factura.pdf",
        previewUrl: "/files/preview/file-2",
        state: "ready_for_review",
        reasonCode: null,
        confidence: "high",
        analysisJobId: null,
        updatedAt: new Date().toISOString(),
      },
    ]),
    false
  )
})

test("isQuickReviewEligible permite corregir criticos pero bloquea baja confianza y errores graves", () => {
  assert.equal(
    contractModule.isQuickReviewEligible({
      state: "ready_for_review",
      reasonCode: "missing_critical_fields",
      confidence: "medium",
    }),
    true
  )

  assert.equal(
    contractModule.isQuickReviewEligible({
      state: "ready_for_review",
      reasonCode: "low_confidence",
      confidence: "low",
    }),
    false
  )

  assert.equal(
    contractModule.isQuickReviewEligible({
      state: "error",
      reasonCode: "analysis_failed",
      confidence: "medium",
    }),
    false
  )
})

test("getInboxPrimaryAction prioriza revisar, esperar o escritorio segun el estado", () => {
  assert.deepEqual(
    contractModule.getInboxPrimaryAction({
      fileId: "file-1",
      reviewUrl: "/capture/review/file-1",
      desktopUrl: "/unsorted#file-1",
      state: "ready_for_review",
    }),
    {
      href: "/capture/review/file-1",
      label: "Revisar",
      disabled: false,
    }
  )

  assert.deepEqual(
    contractModule.getInboxPrimaryAction({
      fileId: "file-2",
      reviewUrl: null,
      desktopUrl: "/unsorted#file-2",
      state: "analyzing",
    }),
    {
      href: null,
      label: "Analizando",
      disabled: true,
    }
  )

  assert.deepEqual(
    contractModule.getInboxPrimaryAction({
      fileId: "file-3",
      reviewUrl: null,
      desktopUrl: "/unsorted#file-3",
      state: "deferred_to_desktop",
    }),
    {
      href: "/unsorted#file-3",
      label: "Escritorio",
      disabled: false,
    }
  )
})

test("shouldShowDesktopShortcut evita duplicar el acceso a escritorio cuando ya es la accion principal", () => {
  assert.equal(
    contractModule.shouldShowDesktopShortcut(
      {
        href: "/unsorted#file-3",
        label: "Escritorio",
        disabled: false,
      },
      "/unsorted#file-3"
    ),
    false
  )

  assert.equal(
    contractModule.shouldShowDesktopShortcut(
      {
        href: "/capture/review/file-1",
        label: "Revisar",
        disabled: false,
      },
      "/unsorted#file-1"
    ),
    true
  )
})

test("getSystemStatusBanner detecta bloqueos del canal movil", () => {
  assert.deepEqual(
    contractModule.getSystemStatusBanner({
      llmConfigured: false,
      workerAvailable: true,
      storageAvailable: true,
      blockingReasonCode: "llm_not_configured",
    }),
    {
      title: "Configura el análisis",
      description: "Falta activar un proveedor para analizar documentos desde el móvil.",
    }
  )

  assert.equal(
    contractModule.getSystemStatusBanner({
      llmConfigured: true,
      workerAvailable: true,
      storageAvailable: true,
      blockingReasonCode: null,
    }),
    null
  )
})

test("getHumanStateLabel presenta los estados moviles con copy legible", () => {
  assert.equal(contractModule.getHumanStateLabel("analyzing"), "Analizando")
  assert.equal(contractModule.getHumanStateLabel("ready_for_review"), "Lista para revisar")
  assert.equal(contractModule.getHumanStateLabel("deferred_to_desktop"), "Pendiente de escritorio")
  assert.equal(contractModule.getHumanStateLabel("error"), "Error")
})

test("getReviewEscalation resume el motivo legible y fuerza escritorio cuando procede", () => {
  assert.deepEqual(
    contractModule.getReviewEscalation({
      reasonCode: "low_confidence",
      confidence: "low",
      desktopUrl: "/unsorted#file-1",
    }),
    {
      tone: "warning",
      reason: "La captura no da suficiente contexto para cerrarla desde el móvil. Revísala completa en escritorio.",
      desktopHref: "/unsorted#file-1",
    }
  )

  assert.equal(
    contractModule.getReviewEscalation({
      reasonCode: "missing_critical_fields",
      confidence: "medium",
      desktopUrl: "/unsorted#file-1",
    }),
    null
  )
})
