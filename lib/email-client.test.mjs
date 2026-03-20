import assert from "node:assert/strict"
import test from "node:test"

import { createResendClient } from "./email-client.ts"

test("createResendClient returns null when the API key is empty", () => {
  assert.equal(createResendClient(""), null)
  assert.equal(createResendClient("   "), null)
  assert.equal(createResendClient(undefined), null)
})

test("createResendClient creates a Resend client when the API key is present", () => {
  assert.notEqual(createResendClient("re_123"), null)
})
