import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("el shell PWA standalone prioriza captura e inbox con menos chrome", async () => {
  const [mobileMenuSource, capturePageSource, inboxPageSource, uploaderSource, messagesSource] = await Promise.all([
    readProjectFile("components/sidebar/mobile-menu.tsx"),
    readProjectFile("app/(app)/capture/page.tsx"),
    readProjectFile("app/(app)/capture/inbox/page.tsx"),
    readProjectFile("components/capture/mobile-capture-uploader.tsx"),
    readProjectFile("lib/i18n/messages.ts"),
  ])

  assert.match(mobileMenuSource, /href="\/capture"/)
  assert.match(mobileMenuSource, /href="\/capture\/inbox"/)
  assert.match(mobileMenuSource, /t\("capture\.inbox\.title"\)/)
  assert.match(mobileMenuSource, /hidden \[@media\(display-mode:standalone\)\]:flex/)
  assert.match(mobileMenuSource, /flex \[@media\(display-mode:standalone\)\]:hidden/)
  assert.doesNotMatch(mobileMenuSource, /useEffect/)
  assert.doesNotMatch(mobileMenuSource, /useState/)
  assert.doesNotMatch(mobileMenuSource, /matchMedia\("\(display-mode: standalone\)"\)/)
  assert.doesNotMatch(mobileMenuSource, /navigator\.standalone === true/)
  assert.doesNotMatch(mobileMenuSource, /href="\/capture\/inbox"[\s\S]*unsortedFilesCount/)

  assert.doesNotMatch(capturePageSource, /href="\/capture"/)
  assert.doesNotMatch(capturePageSource, /href="\/capture\/inbox"/)
  assert.doesNotMatch(capturePageSource, /\[@media\(display-mode:standalone\)\]:flex/)
  assert.match(capturePageSource, /\[@media\(display-mode:standalone\)\]:gap-4/)

  assert.doesNotMatch(inboxPageSource, /href="\/capture"/)
  assert.doesNotMatch(inboxPageSource, /href="\/capture\/inbox"/)
  assert.doesNotMatch(inboxPageSource, /\[@media\(display-mode:standalone\)\]:flex/)
  assert.match(inboxPageSource, /\[@media\(display-mode:standalone\)\]:gap-4/)
  assert.match(inboxPageSource, /let inbox = EMPTY_INBOX_RESPONSE/)
  assert.match(inboxPageSource, /try \{/)
  assert.match(inboxPageSource, /const response = await fetch/)
  assert.match(inboxPageSource, /await response\.json\(\)/)
  assert.match(inboxPageSource, /catch/)

  assert.doesNotMatch(uploaderSource, /useEffect/)
  assert.doesNotMatch(uploaderSource, /\[isStandalone, setIsStandalone\]/)
  assert.doesNotMatch(uploaderSource, /matchMedia\("\(display-mode: standalone\)"\)/)
  assert.doesNotMatch(uploaderSource, /navigator\.standalone === true/)
  assert.match(uploaderSource, /\[@media\(display-mode:standalone\)\]:space-y-3/)
  assert.match(uploaderSource, /\[@media\(display-mode:standalone\)\]:h-16/)
  assert.match(uploaderSource, /\[@media\(display-mode:standalone\)\]:p-3/)
  assert.match(uploaderSource, /useI18n\(\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.takePhoto"\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.uploadFile"\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.description"\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.errorTitle"\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.resultTitle"\)/)
  assert.doesNotMatch(uploaderSource, /getHumanStateLabel/)
  assert.match(uploaderSource, /const MOBILE_CAPTURE_STATE_MESSAGE_KEYS: Record<MobileItemState, MessageKey> = \{/)
  assert.match(uploaderSource, /\[MOBILE_ITEM_STATE\.ANALYZING\]: "capture\.uploader\.state\.analyzing"/)
  assert.match(uploaderSource, /\[MOBILE_ITEM_STATE\.READY_FOR_REVIEW\]: "capture\.uploader\.state\.readyForReview"/)
  assert.match(uploaderSource, /\[MOBILE_ITEM_STATE\.DEFERRED_TO_DESKTOP\]: "capture\.uploader\.state\.deferredToDesktop"/)
  assert.match(uploaderSource, /\[MOBILE_ITEM_STATE\.ERROR\]: "capture\.uploader\.state\.error"/)
  assert.match(uploaderSource, /const humanState = result \? t\(MOBILE_CAPTURE_STATE_MESSAGE_KEYS\[result\.state\]\) : t\("capture\.uploader\.state\.error"\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.resultDescription", \{ state: humanState \}\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.openInbox"\)/)
  assert.match(uploaderSource, /t\("capture\.uploader\.openReview"\)/)
  assert.doesNotMatch(uploaderSource, /Haz una foto del ticket/)
  assert.doesNotMatch(uploaderSource, /Documento recibido/)

  assert.match(messagesSource, /"capture\.uploader\.takePhoto": "Take photo"/)
  assert.match(messagesSource, /"capture\.uploader\.takePhoto": "Hacer foto"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.analyzing": "Analyzing"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.readyForReview": "Ready for review"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.deferredToDesktop": "Continue on desktop"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.error": "Error"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.analyzing": "Analizando"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.readyForReview": "Lista para revisar"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.deferredToDesktop": "Pendiente de escritorio"/)
  assert.match(messagesSource, /"capture\.uploader\.state\.error": "Error"/)
  assert.match(messagesSource, /"capture\.uploader\.resultDescription": "Initial status: \{state\}\./)
  assert.match(messagesSource, /"capture\.uploader\.resultDescription":\s+"Estado inicial: \{state\}\./)
})
