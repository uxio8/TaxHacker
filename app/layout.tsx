import config from "@/lib/config"
import { getI18nConfig } from "@/lib/i18n"
import { I18nProvider } from "@/lib/i18n/provider"
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    template: "%s | TaxHacker",
    default: config.app.title,
  },
  description: config.app.description,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  metadataBase: new URL(config.app.baseURL),
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: config.app.baseURL,
    title: config.app.title,
    description: config.app.description,
    siteName: config.app.title,
  },
  twitter: {
    card: "summary_large_image",
    title: config.app.title,
    description: config.app.description,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const i18n = getI18nConfig()

  return (
    <html lang={i18n.locale}>
      <body className="min-h-screen bg-white antialiased">
        <I18nProvider locale={i18n.locale} messages={i18n.messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
