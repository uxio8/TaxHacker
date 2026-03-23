import { NewsletterWelcomeEmail } from "@/components/emails/newsletter-welcome-email"
import { OTPEmail } from "@/components/emails/otp-email"
import React from "react"
import config from "./config"
import { createResendClient } from "./email-client"

export const resend = createResendClient(config.email.apiKey)

function getConfiguredResendClient() {
  if (!resend) {
    throw new Error("Email is not configured. Set RESEND_API_KEY to enable email features.")
  }

  return resend
}

export async function sendOTPCodeEmail({ email, otp }: { email: string; otp: string }) {
  const html = React.createElement(OTPEmail, { otp })
  const client = getConfiguredResendClient()

  return await client.emails.send({
    from: config.email.from,
    to: email,
    subject: `Your ${config.app.title} verification code`,
    react: html,
  })
}

export async function sendNewsletterWelcomeEmail(email: string) {
  const html = React.createElement(NewsletterWelcomeEmail)
  const client = getConfiguredResendClient()

  return await client.emails.send({
    from: config.email.from,
    to: email,
    subject: `Welcome to ${config.app.title} Newsletter!`,
    react: html,
  })
}
