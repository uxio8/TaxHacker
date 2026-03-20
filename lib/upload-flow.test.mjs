import assert from "node:assert/strict"
import test from "node:test"

import { getUploadFlowState, resetFileInputValue } from "./upload-flow.ts"

test("getUploadFlowState refreshes the unsorted page instead of no-op navigating to the same route", () => {
  assert.deepEqual(
    getUploadFlowState({
      currentPath: "/unsorted",
      destination: "unsorted",
    }),
    {
      notificationCode: "sidebar.unsorted",
      redirectPath: null,
      shouldRefresh: true,
    }
  )
})

test("getUploadFlowState redirects to unsorted when upload starts elsewhere", () => {
  assert.deepEqual(
    getUploadFlowState({
      currentPath: "/dashboard",
      destination: "unsorted",
    }),
    {
      notificationCode: "sidebar.unsorted",
      redirectPath: "/unsorted",
      shouldRefresh: false,
    }
  )
})

test("getUploadFlowState refreshes transaction routes after transaction uploads", () => {
  assert.deepEqual(
    getUploadFlowState({
      currentPath: "/transactions/abc123",
      destination: "transaction",
    }),
    {
      notificationCode: "sidebar.transactions",
      redirectPath: null,
      shouldRefresh: true,
    }
  )
})

test("resetFileInputValue clears the previous browser selection so the same file can be picked again", () => {
  const input = { value: "already-selected.pdf" }

  resetFileInputValue(input)

  assert.equal(input.value, "")
})
