"use client"

import { FormError } from "@/components/forms/error"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useI18n } from "@/lib/i18n"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function LoginForm({ defaultEmail }: { defaultEmail?: string }) {
  const { t } = useI18n()
  const [email, setEmail] = useState(defaultEmail || "")
  const [otp, setOtp] = useState("")
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })
      if (result.error) {
        setError(result.error.message || t("auth.login.sendCodeFailed"))
        return
      }
      setIsOtpSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.sendCodeFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      })
      if (result.error) {
        setError(t("auth.login.invalidCode"))
        return
      }

      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.verifyCodeFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={isOtpSent ? handleVerifyOtp : handleSendOtp} className="flex flex-col gap-4 w-full">
      <FormInput
        title={t("auth.login.emailLabel")}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isOtpSent}
      />

      {isOtpSent && (
        <FormInput
          title={t("auth.login.otpLabel")}
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
          maxLength={6}
          pattern="[0-9]{6}"
        />
      )}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? t("common.feedback.loading") : isOtpSent ? t("auth.login.verifyCode") : t("auth.login.enter")}
      </Button>

      {error && <FormError className="text-center">{error}</FormError>}
    </form>
  )
}
