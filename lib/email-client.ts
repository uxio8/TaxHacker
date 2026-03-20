import { Resend } from "resend"

export function createResendClient(apiKey?: string): Resend | null {
  const normalizedApiKey = apiKey?.trim()

  if (!normalizedApiKey) {
    return null
  }

  return new Resend(normalizedApiKey)
}
