import React from "react"
import config from "@/lib/config"
import { EmailLayout } from "./email-layout"

interface OTPEmailProps {
  otp: string
}

export const OTPEmail: React.FC<OTPEmailProps> = ({ otp }) => (
  <EmailLayout preview={`Tu código de verificación de ${config.app.title}`}>
    <h2 style={{ textAlign: "center", color: "#4f46e5" }}>🔑 Tu código de verificación de {config.app.title}</h2>
    <div
      style={{
        margin: "20px 0",
        padding: "20px",
        backgroundColor: "#f3f4f6",
        borderRadius: "6px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "16px", marginBottom: "10px" }}>Tu código de verificación es:</p>
      <p
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: "#4f46e5",
          letterSpacing: "2px",
          margin: "0",
        }}
      >
        {otp}
      </p>
    </div>
    <p style={{ fontSize: "14px", color: "#666", textAlign: "center" }}>Este código caduca en 10 minutos.</p>
    <p style={{ fontSize: "14px", color: "#666", textAlign: "center" }}>
      Si no has solicitado este código, puedes ignorar este correo.
    </p>
  </EmailLayout>
)
