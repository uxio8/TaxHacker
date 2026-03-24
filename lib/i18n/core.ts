import config from "../config.ts"
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  MESSAGE_CATALOGS,
  SUPPORTED_LOCALES,
  type Locale,
  type MessageCatalog,
  type MessageKey,
} from "./messages.ts"

export interface TranslationValues {
  [key: string]: number | string
}

export interface I18nConfig {
  locale: Locale
  messages: MessageCatalog
}

export interface CreateTranslatorOptions {
  locale?: string
  messages?: MessageCatalog
}

export interface TranslateOptions extends CreateTranslatorOptions {
  values?: TranslationValues
}

export type Translator = (key: MessageKey, values?: TranslationValues) => string

export function resolveLocale(locale?: string): Locale {
  if (locale === SUPPORTED_LOCALES.EN) {
    return SUPPORTED_LOCALES.EN
  }

  return DEFAULT_LOCALE
}

export function getMessages(locale: Locale = DEFAULT_LOCALE): MessageCatalog {
  return MESSAGE_CATALOGS[resolveLocale(locale)]
}

export function getI18nConfig(locale?: string): I18nConfig {
  const resolvedLocale = resolveLocale(locale)

  return {
    locale: resolvedLocale,
    messages: getMessages(resolvedLocale),
  }
}

export function formatMessage(template: string, values?: TranslationValues): string {
  if (!values) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    const replacement = values[token]

    if (replacement === undefined) {
      return `{${token}}`
    }

    return String(replacement)
  })
}

function getDefaultTranslationValues(): TranslationValues {
  return {
    appName: config.app.title,
    demoCompanyName: config.app.demoCompanyName,
  }
}

function mergeTranslationValues(values?: TranslationValues): TranslationValues {
  return {
    ...getDefaultTranslationValues(),
    ...(values ?? {}),
  }
}

function resolveTemplate(key: MessageKey, locale: Locale, messages?: MessageCatalog): string {
  const activeMessages = messages ?? getMessages(locale)

  return activeMessages[key] ?? MESSAGE_CATALOGS[FALLBACK_LOCALE][key] ?? key
}

export function t(key: MessageKey, options: TranslateOptions = {}): string {
  const locale = resolveLocale(options.locale)

  return formatMessage(resolveTemplate(key, locale, options.messages), mergeTranslationValues(options.values))
}

export function createTranslator(options: CreateTranslatorOptions = {}): Translator {
  const locale = resolveLocale(options.locale)
  const messages = options.messages ?? getMessages(locale)

  return (key, values) => formatMessage(resolveTemplate(key, locale, messages), mergeTranslationValues(values))
}
