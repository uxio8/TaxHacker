import config from "../config.ts"
import type { BillingAddonDefinition, BillingPlanDefinition, CatalogSku } from "./catalog-types.ts"

export const BILLING_CATALOG_VERSION = 1

export const BILLING_PLANS: Record<string, BillingPlanDefinition> = {
  unlimited: {
    code: "unlimited",
    displayName: "Unlimited",
    description: "Plan interno para self-hosted y bypass operativo.",
    benefits: ["Todo habilitado", "Sin limites de almacenamiento", "Sin limites de analisis IA"],
    priceLabel: "",
    stripePriceId: "",
    capabilities: [
      "documents.capture",
      "documents.ai_analysis",
      "transactions.workspace",
      "invoices.workspace",
      "tax.workspace",
      "tax.filing",
    ],
    limits: {
      "storage.bytes": -1,
      "ai.jobs.monthly": -1,
      "members.max": -1,
    },
    isAvailable: false,
    isPublic: false,
    version: BILLING_CATALOG_VERSION,
  },
  early: {
    code: "early",
    displayName: "Early Adopter",
    description: "Plan legado para los primeros usuarios cloud.",
    benefits: [
      "512 MB de almacenamiento",
      "1000 analisis IA al mes",
      "Flujo fiscal completo",
      "Transacciones, campos, categorias y proyectos sin limite practico",
    ],
    priceLabel: "€35 al año",
    stripePriceId: "price_1RHTj1As8DS4NhOzhejpTN3I",
    capabilities: [
      "documents.capture",
      "documents.ai_analysis",
      "transactions.workspace",
      "invoices.workspace",
      "tax.workspace",
      "tax.filing",
    ],
    limits: {
      "storage.bytes": 512 * 1024 * 1024,
      "ai.jobs.monthly": 1000,
      "members.max": 5,
    },
    isAvailable: true,
    isPublic: false,
    version: BILLING_CATALOG_VERSION,
  },
  starter: {
    code: "starter",
    displayName: "Starter",
    description: "Base para documentacion y operativa diaria.",
    benefits: ["Captura y registro diario", "Analisis IA incluido", "Facturacion basica"],
    priceLabel: "",
    stripePriceId: config.stripe.priceIds.starter,
    capabilities: [
      "documents.capture",
      "documents.ai_analysis",
      "transactions.workspace",
      "invoices.workspace",
    ],
    limits: {
      "storage.bytes": 2 * 1024 * 1024 * 1024,
      "ai.jobs.monthly": 500,
      "members.max": 3,
    },
    isAvailable: Boolean(config.stripe.priceIds.starter),
    isPublic: true,
    version: BILLING_CATALOG_VERSION,
  },
  pro: {
    code: "pro",
    displayName: "Pro",
    description: "Operacion diaria mas margen y mejor automatizacion.",
    benefits: ["Mas almacenamiento", "Mas IA", "Pensado para empresas activas"],
    priceLabel: "",
    stripePriceId: config.stripe.priceIds.pro,
    capabilities: [
      "documents.capture",
      "documents.ai_analysis",
      "transactions.workspace",
      "invoices.workspace",
    ],
    limits: {
      "storage.bytes": 10 * 1024 * 1024 * 1024,
      "ai.jobs.monthly": 3000,
      "members.max": 10,
    },
    isAvailable: Boolean(config.stripe.priceIds.pro),
    isPublic: true,
    version: BILLING_CATALOG_VERSION,
  },
}

export const BILLING_ADDONS: Record<string, BillingAddonDefinition> = {
  tax: {
    code: "tax",
    displayName: "Fiscal",
    description: "Desbloquea workspace fiscal y presentacion guiada.",
    stripePriceId: config.stripe.priceIds.addons.tax,
    benefitLabel: "Workspace fiscal completo",
    capabilityAdds: ["tax.workspace", "tax.filing"],
    isAvailable: Boolean(config.stripe.priceIds.addons.tax),
    version: BILLING_CATALOG_VERSION,
  },
  ai_plus: {
    code: "ai_plus",
    displayName: "AI Plus",
    description: "Amplia el volumen mensual de analisis IA.",
    stripePriceId: config.stripe.priceIds.addons.aiPlus,
    benefitLabel: "3000 analisis IA extra al mes",
    limitIncrements: {
      "ai.jobs.monthly": 3000,
    },
    isAvailable: Boolean(config.stripe.priceIds.addons.aiPlus),
    version: BILLING_CATALOG_VERSION,
  },
  extra_storage: {
    code: "extra_storage",
    displayName: "Extra Storage",
    description: "Amplia almacenamiento para documentacion historica.",
    stripePriceId: config.stripe.priceIds.addons.extraStorage,
    benefitLabel: "10 GB extra",
    limitIncrements: {
      "storage.bytes": 10 * 1024 * 1024 * 1024,
    },
    isAvailable: Boolean(config.stripe.priceIds.addons.extraStorage),
    version: BILLING_CATALOG_VERSION,
  },
  extra_users: {
    code: "extra_users",
    displayName: "Extra Users",
    description: "Amplia el numero de miembros de la empresa.",
    stripePriceId: config.stripe.priceIds.addons.extraUsers,
    benefitLabel: "5 miembros extra",
    limitIncrements: {
      "members.max": 5,
    },
    isAvailable: Boolean(config.stripe.priceIds.addons.extraUsers),
    version: BILLING_CATALOG_VERSION,
  },
}

export function getPlanDefinition(code: string | null | undefined) {
  if (!code) {
    return null
  }

  return BILLING_PLANS[code] ?? null
}

export function getAddonDefinition(code: string | null | undefined) {
  if (!code) {
    return null
  }

  return BILLING_ADDONS[code] ?? null
}

export function getCatalogSkuByStripePriceId(priceId: string | null | undefined): CatalogSku | null {
  if (!priceId) {
    return null
  }

  for (const plan of Object.values(BILLING_PLANS)) {
    if (plan.stripePriceId && plan.stripePriceId === priceId) {
      return {
        kind: "plan",
        code: plan.code,
      }
    }
  }

  for (const addon of Object.values(BILLING_ADDONS)) {
    if (addon.stripePriceId && addon.stripePriceId === priceId) {
      return {
        kind: "addon",
        code: addon.code,
      }
    }
  }

  return null
}
