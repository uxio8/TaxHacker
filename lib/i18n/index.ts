export {
  DEFAULT_LOCALE,
  EN_MESSAGES,
  ES_ES_MESSAGES,
  FALLBACK_LOCALE,
  MESSAGE_CATALOGS,
  SUPPORTED_LOCALES,
  type Locale,
  type MessageCatalog,
  type MessageKey,
} from "./messages.ts"

export {
  createTranslator,
  formatMessage,
  getI18nConfig,
  getMessages,
  resolveLocale,
  t,
  type CreateTranslatorOptions,
  type I18nConfig,
  type TranslationValues,
  type TranslateOptions,
  type Translator,
} from "./core.ts"

export { I18nProvider, useI18n } from "./provider.tsx"
