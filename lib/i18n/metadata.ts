import type { Metadata } from "next"

import { createTranslator, type TranslationValues } from "./core.ts"
import type { MessageKey } from "./messages.ts"

interface CreatePageMetadataOptions {
  descriptionKey?: MessageKey
  descriptionValues?: TranslationValues
  titleValues?: TranslationValues
}

export function createPageMetadata(titleKey: MessageKey, options: CreatePageMetadataOptions = {}): Metadata {
  const t = createTranslator()
  const metadata: Metadata = {
    title: t(titleKey, options.titleValues),
  }

  if (options.descriptionKey) {
    metadata.description = t(options.descriptionKey, options.descriptionValues)
  }

  return metadata
}
