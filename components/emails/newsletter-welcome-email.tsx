import React from "react"
import { EmailLayout } from "./email-layout"

export const NewsletterWelcomeEmail: React.FC = () => (
  <EmailLayout preview="Bienvenido a la newsletter de TaxHacker">
    <h2 style={{ color: "#4f46e5" }}>👋 Te damos la bienvenida a TaxHacker</h2>

    <p style={{ fontSize: "16px", lineHeight: "1.5", color: "#333" }}>
      Gracias por suscribirte a nuestras novedades. Te iremos contando:
    </p>
    <ul
      style={{
        paddingLeft: "20px",
        fontSize: "16px",
        lineHeight: "1.5",
        color: "#333",
      }}
    >
      <li>Nuevas funciones y mejoras</li>
      <li>Nuestros planes y próximos pasos</li>
      <li>Novedades sobre la versión SaaS</li>
    </ul>
    <div style={{ marginTop: "30px", borderTop: "1px solid #eee", paddingTop: "20px" }}>
      <p style={{ fontSize: "16px", color: "#333" }}>
        Un saludo,
        <br />
        El equipo de TaxHacker
      </p>
    </div>
  </EmailLayout>
)
