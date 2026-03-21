"use client"

import { createContext, useContext, type ReactNode } from "react"

import { createTranslator, getI18nConfig, type Translator } from "./core.ts"
import type { Locale, MessageCatalog } from "./messages.ts"

interface I18nProviderProps {
  children: ReactNode
  locale?: string
  messages?: MessageCatalog
}

interface I18nContextValue {
  locale: Locale
  messages: MessageCatalog
  t: Translator
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  const i18n = getI18nConfig(locale)
  const activeMessages = messages ?? i18n.messages
  const translate = createTranslator({
    locale: i18n.locale,
    messages: activeMessages,
  })

  return <I18nContext.Provider value={{ locale: i18n.locale, messages: activeMessages, t: translate }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider.")
  }

  return context
}
