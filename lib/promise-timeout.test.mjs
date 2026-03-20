import assert from "node:assert/strict"
import test from "node:test"

import { withTimeout } from "./promise-timeout.ts"

test("withTimeout resolves when the wrapped operation finishes in time", async () => {
  const result = await withTimeout(Promise.resolve("ok"), {
    timeoutMs: 50,
    errorMessage: "timed out",
  })

  assert.equal(result, "ok")
})

test("withTimeout rejects with the provided message when the operation exceeds the timeout", async () => {
  await assert.rejects(
    withTimeout(
      new Promise((resolve) => {
        setTimeout(() => resolve("late"), 40)
      }),
      {
        timeoutMs: 5,
        errorMessage: "operation timed out",
      }
    ),
    /operation timed out/
  )
})
