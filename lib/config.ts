import slugify from "slugify"
import { z } from "zod"
import { SELF_HOSTED_ACCESS_COOKIE_NAME } from "./security.ts"

const envSchema = z.object({
  BASE_URL: z.string().url().default("http://localhost:7331"),
  PORT: z.string().default("7331"),
  APP_NAME: z.string().trim().default("LedgerFlow"),
  APP_DESCRIPTION: z.string().trim().default("AI workspace for receipts, invoices, and operations."),
  SUPPORT_EMAIL: z.string().trim().default("support@localhost"),
  APP_REPOSITORY_URL: z.string().trim().optional(),
  APP_ISSUES_URL: z.string().trim().optional(),
  APP_DONATE_URL: z.string().trim().optional(),
  SELF_HOSTED_MODE: z.enum(["true", "false"]).default("false"),
  SELF_HOSTED_ADMIN_TOKEN: z.string().trim().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_NAME: z.string().default("gpt-4o-mini"),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_MODEL_NAME: z.string().default("gemini-2.5-flash"),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL_NAME: z.string().default("mistral-medium-latest"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "Auth secret must be at least 16 characters")
    .default("please-set-your-key-here"),
  DISABLE_SIGNUP: z.enum(["true", "false"]).default("false"),
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().trim().optional(),
  RESEND_AUDIENCE_ID: z.string().default(""),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_ID_STARTER: z.string().default(""),
  STRIPE_PRICE_ID_PRO: z.string().default(""),
  STRIPE_PRICE_ID_ADDON_TAX: z.string().default(""),
  STRIPE_PRICE_ID_ADDON_AI_PLUS: z.string().default(""),
  STRIPE_PRICE_ID_ADDON_EXTRA_STORAGE: z.string().default(""),
  STRIPE_PRICE_ID_ADDON_EXTRA_USERS: z.string().default(""),
  WORKFLOW_DOCUMENT_SLICE: z.enum(["true", "false"]).default("false"),
  WORKFLOW_FISCAL_SLICE: z.enum(["true", "false"]).default("false"),
  WORKFLOW_TRANSACTIONS_SLICE: z.enum(["true", "false"]).default("false"),
})

function normalizeOptionalUrl(value: string | undefined) {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

export function createConfig(envInput: NodeJS.ProcessEnv = process.env) {
  const env = envSchema.parse(envInput)
  const appTitle = env.APP_NAME || "LedgerFlow"
  const appSlug = slugify(appTitle, { lower: true, strict: true }) || "ledgerflow"
  const appDescription = env.APP_DESCRIPTION || "AI workspace for receipts, invoices, and operations."

  return {
    app: {
      title: appTitle,
      slug: appSlug,
      description: appDescription,
      demoCompanyName: `${appTitle} Demo SL`,
      version: envInput.npm_package_version || "0.0.1",
      baseURL: env.BASE_URL || `http://localhost:${env.PORT || "7331"}`,
      supportEmail: env.SUPPORT_EMAIL,
    },
    links: {
      repositoryUrl: normalizeOptionalUrl(env.APP_REPOSITORY_URL),
      issuesUrl: normalizeOptionalUrl(env.APP_ISSUES_URL),
      donateUrl: normalizeOptionalUrl(env.APP_DONATE_URL),
    },
    upload: {
      acceptedMimeTypes: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
      images: {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 90,
      },
      pdfs: {
        maxPages: 10,
        dpi: 150,
        quality: 90,
        maxWidth: 1500,
        maxHeight: 1500,
      },
    },
    selfHosted: {
      isEnabled: env.SELF_HOSTED_MODE === "true",
      adminToken: env.SELF_HOSTED_ADMIN_TOKEN,
      accessCookieName: SELF_HOSTED_ACCESS_COOKIE_NAME,
      redirectUrl: "/self-hosted/redirect",
      welcomeUrl: "/self-hosted",
    },
    workflow: {
      documentSliceEnabled: env.WORKFLOW_DOCUMENT_SLICE === "true",
      fiscalSliceEnabled: env.WORKFLOW_FISCAL_SLICE === "true",
      transactionsSliceEnabled: env.WORKFLOW_TRANSACTIONS_SLICE === "true",
    },
    ai: {
      openaiApiKey: env.OPENAI_API_KEY,
      openaiModelName: env.OPENAI_MODEL_NAME,
      googleApiKey: env.GOOGLE_API_KEY,
      googleModelName: env.GOOGLE_MODEL_NAME,
      mistralApiKey: env.MISTRAL_API_KEY,
      mistralModelName: env.MISTRAL_MODEL_NAME,
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET,
      loginUrl: "/enter",
      disableSignup: env.DISABLE_SIGNUP === "true" || env.SELF_HOSTED_MODE === "true",
    },
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      paymentSuccessUrl: `${env.BASE_URL}/cloud/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      paymentCancelUrl: `${env.BASE_URL}/cloud`,
      priceIds: {
        starter: env.STRIPE_PRICE_ID_STARTER,
        pro: env.STRIPE_PRICE_ID_PRO,
        addons: {
          tax: env.STRIPE_PRICE_ID_ADDON_TAX,
          aiPlus: env.STRIPE_PRICE_ID_ADDON_AI_PLUS,
          extraStorage: env.STRIPE_PRICE_ID_ADDON_EXTRA_STORAGE,
          extraUsers: env.STRIPE_PRICE_ID_ADDON_EXTRA_USERS,
        },
      },
    },
    email: {
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM_EMAIL || `${appTitle} <user@localhost>`,
      audienceId: env.RESEND_AUDIENCE_ID,
    },
  } as const
}

const config = createConfig()

export default config
