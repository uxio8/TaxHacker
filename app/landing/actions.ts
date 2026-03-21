"use server"

import config from "@/lib/config"
import { resend, sendNewsletterWelcomeEmail } from "@/lib/email"

export async function subscribeToNewsletterAction(email: string) {
  try {
    if (!email || !email.includes("@")) {
      return { success: false, error: "La dirección de correo no es válida" }
    }

    if (!resend || !config.email.audienceId) {
      return { success: false, error: "La newsletter todavía no está configurada" }
    }

    const existingContacts = await resend.contacts.list({
      audienceId: config.email.audienceId,
    })

    if (existingContacts.data) {
      const existingContact = existingContacts.data.data.find((contact: { email: string }) => contact.email === email)

      if (existingContact) {
        return { success: false, error: "Ya estás suscrito a la newsletter" }
      }
    }

    await resend.contacts.create({
      email,
      audienceId: config.email.audienceId,
      unsubscribed: false,
    })

    await sendNewsletterWelcomeEmail(email)

    return { success: true }
  } catch (error) {
    console.error("Newsletter subscription error:", error)
    return { error: "No se ha podido completar la suscripción. Inténtalo de nuevo más tarde." }
  }
}
