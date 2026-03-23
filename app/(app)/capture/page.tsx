import { MobileCaptureUploader } from "@/components/capture/mobile-capture-uploader"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { Card } from "@/components/ui/card"
import { createPageMetadata, createTranslator } from "@/lib/i18n"

export const metadata = createPageMetadata("capture.title", {
  descriptionKey: "capture.description",
})

export default async function CapturePage() {
  const t = createTranslator()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 [@media(display-mode:standalone)]:gap-4">
      <Card className="rounded-[28px] border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.28),_rgba(255,255,255,0.98)_48%),linear-gradient(135deg,rgba(15,23,42,0.04),rgba(14,165,233,0.12))] p-6 shadow-sm [@media(display-mode:standalone)]:rounded-2xl [@media(display-mode:standalone)]:p-4">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">{t("capture.title")}</p>
          <h1 className="text-3xl font-semibold tracking-tight [@media(display-mode:standalone)]:text-2xl">
            {t("capture.hero.title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("capture.hero.description")}</p>
        </div>
      </Card>

      <InstallPrompt />

      <Card className="rounded-[28px] border-slate-200 p-5 [@media(display-mode:standalone)]:rounded-2xl [@media(display-mode:standalone)]:p-4">
        <MobileCaptureUploader />
      </Card>
    </main>
  )
}
