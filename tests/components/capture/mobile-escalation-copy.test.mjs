import assert from "node:assert/strict"
import test from "node:test"

const contractModule = await import(new URL("../../../components/capture/mobile-contract.ts", import.meta.url))

test("getInboxGuidance explica el traspaso a escritorio cuando el documento viene diferido", () => {
  assert.deepEqual(
    contractModule.getInboxGuidance({
      state: "deferred_to_desktop",
      reasonCode: "user_deferred",
      confidence: "medium",
    }),
    {
      title: "Termínalo en escritorio",
      description: "Lo marcaste para seguir allí sin perder el contexto del documento.",
    }
  )
})

test("getReviewGuidance mantiene copy humano cuando faltan críticos", () => {
  assert.deepEqual(
    contractModule.getReviewGuidance({
      state: "ready_for_review",
      reasonCode: "missing_critical_fields",
      confidence: "medium",
    }),
    {
      title: "Completa los críticos",
      description: "Corrige proveedor, fecha, importe y moneda. Si necesitas más campos, pásalo a escritorio.",
    }
  )
})
