import { prisma } from "@/lib/db"
import {
  CURRENT_DEFAULT_PROMPT_ANALYSE_NEW_FILE,
  DEFAULTS_SYNC_VERSION,
  DEFAULTS_SYNC_VERSION_SETTING_CODE,
  EXTRA_BILLING_DEFAULT_FIELDS,
  LEGACY_EXTRA_BILLING_DEFAULT_FIELDS,
  getMissingDefaultFields,
  shouldUpgradeDefaultAnalysisPrompt,
} from "@/lib/default-field-sync"

export const DEFAULT_PROMPT_ANALYSE_NEW_FILE = CURRENT_DEFAULT_PROMPT_ANALYSE_NEW_FILE

const LEGACY_DEFAULT_SETTINGS = [
  {
    code: "default_currency",
    name: "Default Currency",
    description: "Don't change this setting if you already have multi-currency transactions. I won't recalculate them.",
    value: "EUR",
  },
  {
    code: "default_category",
    name: "Default Category",
    description: "",
    value: "other",
  },
  {
    code: "default_project",
    name: "Default Project",
    description: "",
    value: "personal",
  },
  {
    code: "default_type",
    name: "Default Type",
    description: "",
    value: "expense",
  },
  {
    code: "prompt_analyse_new_file",
    name: "Prompt for Analyze Transaction",
    description: "Allowed variables: {fields}, {categories}, {categories.code}, {projects}, {projects.code}",
    value: DEFAULT_PROMPT_ANALYSE_NEW_FILE,
  },
  {
    code: "is_welcome_message_hidden",
    name: "Do not show welcome message on dashboard",
    description: "",
    value: "false",
  },
]

const DEFAULT_SETTING_LOCALIZATION: Partial<
  Record<(typeof LEGACY_DEFAULT_SETTINGS)[number]["code"], { description: string; name: string }>
> = {
  default_currency: {
    name: "Moneda por defecto",
    description: "No cambies este ajuste si ya tienes transacciones en varias divisas. No se recalcularán.",
  },
  default_category: {
    name: "Categoría por defecto",
    description: "",
  },
  default_project: {
    name: "Proyecto por defecto",
    description: "",
  },
  default_type: {
    name: "Tipo por defecto",
    description: "",
  },
  prompt_analyse_new_file: {
    name: "Prompt del formulario de análisis de archivos",
    description: "Variables permitidas: {fields}, {categories}, {categories.code}, {projects}, {projects.code}",
  },
  is_welcome_message_hidden: {
    name: "No mostrar el mensaje de bienvenida en el panel",
    description: "",
  },
}

export const DEFAULT_SETTINGS = LEGACY_DEFAULT_SETTINGS.map((setting) => ({
  ...setting,
  ...DEFAULT_SETTING_LOCALIZATION[setting.code],
}))

const LEGACY_DEFAULT_CATEGORIES = [
  {
    code: "ads",
    name: "Advertisement",
    color: "#882727",
    llm_prompt: "ads, promos, online ads, etc",
  },
  {
    code: "swag",
    name: "Swag and Goods",
    color: "#882727",
    llm_prompt: "swag, stickers, goods, etc",
  },
  { code: "donations", name: "Gifts and Donations", color: "#1e6359", llm_prompt: "donations, gifts, charity" },
  { code: "tools", name: "Equipment and Tools", color: "#c69713", llm_prompt: "equipment, tools" },
  { code: "events", name: "Events and Conferences", color: "#ff8b32", llm_prompt: "events, conferences" },
  { code: "food", name: "Food and Drinks", color: "#d40e70", llm_prompt: "food, drinks, business meals" },
  { code: "insurance", name: "Insurance", color: "#050942", llm_prompt: "insurance, health, life" },
  { code: "invoice", name: "Invoice", color: "#064e85", llm_prompt: "custom invoice, bill" },
  { code: "communication", name: "Mobile and Internet", color: "#0e7d86", llm_prompt: "mobile, internet, phone" },
  { code: "office", name: "Office Supplies", color: "#59b0b9", llm_prompt: "office, supplies, stationery" },
  { code: "online", name: "Online Services", color: "#8753fb", llm_prompt: "online services, saas, subscriptions" },
  { code: "rental", name: "Rental", color: "#050942", llm_prompt: "rental, lease" },
  {
    code: "education",
    name: "Education",
    color: "#ee5d6c",
    llm_prompt: "education, professional development, trainings",
  },
  { code: "salary", name: "Salary", color: "#ce4993", llm_prompt: "salary, wages, etc" },
  { code: "fees", name: "Fees", color: "#6a0d83", llm_prompt: "fees, charges, penalties, etc" },
  { code: "travel", name: "Travel Expenses", color: "#fb9062", llm_prompt: "travel, accommodation, etc" },
  { code: "utility_bills", name: "Utility Bills", color: "#af7e2e", llm_prompt: "bills, electricity, water, etc" },
  {
    code: "transport",
    name: "Transport",
    color: "#800000",
    llm_prompt: "transportation costs, fuel, car rental, vignettes, etc",
  },
  { code: "software", name: "Software", color: "#2b5a1d", llm_prompt: "software, licenses" },
  { code: "other", name: "Other", color: "#121216", llm_prompt: "other, miscellaneous," },
]

const DEFAULT_CATEGORY_LOCALIZATION: Partial<
  Record<(typeof LEGACY_DEFAULT_CATEGORIES)[number]["code"], { llm_prompt: string; name: string }>
> = {
  ads: { name: "Publicidad", llm_prompt: "publicidad, promociones, anuncios online, etc." },
  swag: { name: "Merchandising y productos", llm_prompt: "merchandising, pegatinas, productos, etc." },
  donations: { name: "Regalos y donaciones", llm_prompt: "donaciones, regalos, caridad" },
  tools: { name: "Equipamiento y herramientas", llm_prompt: "equipamiento, herramientas" },
  events: { name: "Eventos y conferencias", llm_prompt: "eventos, conferencias" },
  food: { name: "Comida y bebida", llm_prompt: "comida, bebida, comidas de trabajo" },
  insurance: { name: "Seguros", llm_prompt: "seguros, salud, vida" },
  invoice: { name: "Factura", llm_prompt: "factura personalizada, factura, recibo" },
  communication: { name: "Móvil e internet", llm_prompt: "móvil, internet, teléfono" },
  office: { name: "Material de oficina", llm_prompt: "oficina, suministros, papelería" },
  online: { name: "Servicios online", llm_prompt: "servicios online, SaaS, suscripciones" },
  rental: { name: "Alquiler", llm_prompt: "alquiler, arrendamiento" },
  education: { name: "Formación", llm_prompt: "formación, desarrollo profesional, cursos" },
  salary: { name: "Salarios", llm_prompt: "salario, nóminas, etc." },
  fees: { name: "Comisiones y recargos", llm_prompt: "comisiones, cargos, penalizaciones, etc." },
  travel: { name: "Gastos de viaje", llm_prompt: "viajes, alojamiento, etc." },
  utility_bills: { name: "Suministros", llm_prompt: "facturas, electricidad, agua, etc." },
  transport: { name: "Transporte", llm_prompt: "costes de transporte, combustible, alquiler de coche, peajes, etc." },
  software: { name: "Software", llm_prompt: "software, licencias" },
  other: { name: "Otros", llm_prompt: "otros, miscelánea" },
}

export const DEFAULT_CATEGORIES = LEGACY_DEFAULT_CATEGORIES.map((category) => ({
  ...category,
  ...DEFAULT_CATEGORY_LOCALIZATION[category.code],
}))

const LEGACY_DEFAULT_PROJECTS = [{ code: "personal", name: "Personal", llm_prompt: "personal", color: "#1e202b" }]

const DEFAULT_PROJECT_LOCALIZATION: Partial<
  Record<(typeof LEGACY_DEFAULT_PROJECTS)[number]["code"], { llm_prompt: string; name: string }>
> = {
  personal: {
    name: "Personal",
    llm_prompt: "personal",
  },
}

export const DEFAULT_PROJECTS = LEGACY_DEFAULT_PROJECTS.map((project) => ({
  ...project,
  ...DEFAULT_PROJECT_LOCALIZATION[project.code],
}))

export const DEFAULT_CURRENCIES = [
  { code: "USD", name: "$" },
  { code: "EUR", name: "€" },
  { code: "GBP", name: "£" },
  { code: "INR", name: "₹" },
  { code: "AUD", name: "$" },
  { code: "CAD", name: "$" },
  { code: "SGD", name: "$" },
  { code: "CHF", name: "Fr" },
  { code: "MYR", name: "RM" },
  { code: "JPY", name: "¥" },
  { code: "CNY", name: "¥" },
  { code: "NZD", name: "$" },
  { code: "THB", name: "฿" },
  { code: "HUF", name: "Ft" },
  { code: "AED", name: "د.إ" },
  { code: "HKD", name: "$" },
  { code: "MXN", name: "$" },
  { code: "ZAR", name: "R" },
  { code: "PHP", name: "₱" },
  { code: "SEK", name: "kr" },
  { code: "IDR", name: "Rp" },
  { code: "BRL", name: "R$" },
  { code: "SAR", name: "﷼" },
  { code: "TRY", name: "₺" },
  { code: "KES", name: "KSh" },
  { code: "KRW", name: "₩" },
  { code: "EGP", name: "£" },
  { code: "IQD", name: "ع.د" },
  { code: "NOK", name: "kr" },
  { code: "KWD", name: "د.ك" },
  { code: "RUB", name: "₽" },
  { code: "DKK", name: "kr" },
  { code: "PKR", name: "₨" },
  { code: "ILS", name: "₪" },
  { code: "PLN", name: "zł" },
  { code: "QAR", name: "﷼" },
  { code: "OMR", name: "﷼" },
  { code: "COP", name: "$" },
  { code: "CLP", name: "$" },
  { code: "TWD", name: "NT$" },
  { code: "ARS", name: "$" },
  { code: "CZK", name: "Kč" },
  { code: "VND", name: "₫" },
  { code: "MAD", name: "د.م." },
  { code: "JOD", name: "د.ا" },
  { code: "BHD", name: ".د.ب" },
  { code: "XOF", name: "CFA" },
  { code: "LKR", name: "₨" },
  { code: "UAH", name: "₴" },
  { code: "NGN", name: "₦" },
  { code: "TND", name: "د.ت" },
  { code: "UGX", name: "USh" },
  { code: "RON", name: "lei" },
  { code: "BDT", name: "৳" },
  { code: "PEN", name: "S/" },
  { code: "GEL", name: "₾" },
  { code: "XAF", name: "FCFA" },
  { code: "FJD", name: "$" },
  { code: "VEF", name: "Bs" },
  { code: "VES", name: "Bs.S" },
  { code: "BYN", name: "Br" },
  { code: "UZS", name: "лв" },
  { code: "BGN", name: "лв" },
  { code: "DZD", name: "د.ج" },
  { code: "IRR", name: "﷼" },
  { code: "DOP", name: "RD$" },
  { code: "ISK", name: "kr" },
  { code: "CRC", name: "₡" },
  { code: "SYP", name: "£" },
  { code: "JMD", name: "J$" },
  { code: "LYD", name: "ل.د" },
  { code: "GHS", name: "₵" },
  { code: "MUR", name: "₨" },
  { code: "AOA", name: "Kz" },
  { code: "UYU", name: "$U" },
  { code: "AFN", name: "؋" },
  { code: "LBP", name: "ل.ل" },
  { code: "XPF", name: "₣" },
  { code: "TTD", name: "TT$" },
  { code: "TZS", name: "TSh" },
  { code: "ALL", name: "Lek" },
  { code: "XCD", name: "$" },
  { code: "GTQ", name: "Q" },
  { code: "NPR", name: "₨" },
  { code: "BOB", name: "Bs." },
  { code: "ZWD", name: "Z$" },
  { code: "BBD", name: "$" },
  { code: "CUC", name: "$" },
  { code: "LAK", name: "₭" },
  { code: "BND", name: "$" },
  { code: "BWP", name: "P" },
  { code: "HNL", name: "L" },
  { code: "PYG", name: "₲" },
  { code: "ETB", name: "Br" },
  { code: "NAD", name: "$" },
  { code: "PGK", name: "K" },
  { code: "SDG", name: "ج.س." },
  { code: "MOP", name: "MOP$" },
  { code: "BMD", name: "$" },
  { code: "NIO", name: "C$" },
  { code: "BAM", name: "KM" },
  { code: "KZT", name: "₸" },
  { code: "PAB", name: "B/." },
  { code: "GYD", name: "$" },
  { code: "YER", name: "﷼" },
  { code: "MGA", name: "Ar" },
  { code: "KYD", name: "$" },
  { code: "MZN", name: "MT" },
  { code: "RSD", name: "дин." },
  { code: "SCR", name: "₨" },
  { code: "AMD", name: "֏" },
  { code: "AZN", name: "₼" },
  { code: "SBD", name: "$" },
  { code: "SLL", name: "Le" },
  { code: "TOP", name: "T$" },
  { code: "BZD", name: "BZ$" },
  { code: "GMD", name: "D" },
  { code: "MWK", name: "MK" },
  { code: "BIF", name: "FBu" },
  { code: "HTG", name: "G" },
  { code: "SOS", name: "S" },
  { code: "GNF", name: "FG" },
  { code: "MNT", name: "₮" },
  { code: "MVR", name: "Rf" },
  { code: "CDF", name: "FC" },
  { code: "STN", name: "Db" },
  { code: "TJS", name: "ЅМ" },
  { code: "KPW", name: "₩" },
  { code: "KGS", name: "лв" },
  { code: "LRD", name: "$" },
  { code: "LSL", name: "L" },
  { code: "MMK", name: "K" },
  { code: "GIP", name: "£" },
  { code: "MDL", name: "L" },
  { code: "CUP", name: "₱" },
  { code: "KHR", name: "៛" },
  { code: "MKD", name: "ден" },
  { code: "VUV", name: "VT" },
  { code: "ANG", name: "ƒ" },
  { code: "MRU", name: "UM" },
  { code: "SZL", name: "L" },
  { code: "CVE", name: "$" },
  { code: "SRD", name: "$" },
  { code: "SVC", name: "$" },
  { code: "BSD", name: "$" },
  { code: "RWF", name: "R₣" },
  { code: "AWG", name: "ƒ" },
  { code: "BTN", name: "Nu." },
  { code: "DJF", name: "Fdj" },
  { code: "KMF", name: "CF" },
  { code: "ERN", name: "Nfk" },
  { code: "FKP", name: "£" },
  { code: "SHP", name: "£" },
  { code: "WST", name: "WS$" },
  { code: "JEP", name: "£" },
  { code: "TMT", name: "m" },
  { code: "GGP", name: "£" },
  { code: "IMP", name: "£" },
  { code: "TVD", name: "$" },
  { code: "ZMW", name: "ZK" },
  { code: "ADA", name: "Crypto" },
  { code: "BCH", name: "Crypto" },
  { code: "BTC", name: "Crypto" },
  { code: "CLF", name: "UF" },
  { code: "CNH", name: "¥" },
  { code: "DOGE", name: "Crypto" },
  { code: "DOT", name: "Crypto" },
  { code: "ETH", name: "Crypto" },
  { code: "LINK", name: "Crypto" },
  { code: "LTC", name: "Crypto" },
  { code: "LUNA", name: "Crypto" },
  { code: "SLE", name: "Le" },
  { code: "UNI", name: "Crypto" },
  { code: "XBT", name: "Crypto" },
  { code: "XLM", name: "Crypto" },
  { code: "XRP", name: "Crypto" },
  { code: "ZWL", name: "$" },
]

const LEGACY_DEFAULT_FIELDS = [
  {
    code: "name",
    name: "Name",
    type: "string",
    llm_prompt: "human readable name, summarize what is bought or paid for in the invoice",
    isVisibleInList: true,
    isVisibleInAnalysis: true,
    isRequired: true,
    isExtra: false,
  },
  {
    code: "description",
    name: "Description",
    type: "string",
    llm_prompt: "description of the transaction",
    isVisibleInList: false,
    isVisibleInAnalysis: false,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "merchant",
    name: "Merchant",
    type: "string",
    llm_prompt: "merchant name, use the original spelling and language",
    isVisibleInList: true,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "issuedAt",
    name: "Issued At",
    type: "string",
    llm_prompt: "issued at date (YYYY-MM-DD format)",
    isVisibleInList: true,
    isVisibleInAnalysis: true,
    isRequired: true,
    isExtra: false,
  },
  {
    code: "projectCode",
    name: "Project",
    type: "string",
    llm_prompt: "project code, one of: {projects.code}",
    isVisibleInList: true,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "categoryCode",
    name: "Category",
    type: "string",
    llm_prompt: "category code, one of: {categories.code}",
    isVisibleInList: true,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "files",
    name: "Files",
    type: "string",
    llm_prompt: "",
    isVisibleInList: true,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "total",
    name: "Total",
    type: "number",
    llm_prompt: "total total of the transaction",
    isVisibleInList: true,
    isVisibleInAnalysis: true,
    isRequired: true,
    isExtra: false,
  },
  {
    code: "currencyCode",
    name: "Currency",
    type: "string",
    llm_prompt: "currency code, ISO 4217 three letter code like USD, EUR, including crypto codes like BTC, ETH, etc",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "convertedTotal",
    name: "Converted Total",
    type: "number",
    llm_prompt: "",
    isVisibleInList: false,
    isVisibleInAnalysis: false,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "convertedCurrencyCode",
    name: "Converted Currency Code",
    type: "string",
    llm_prompt: "",
    isVisibleInList: false,
    isVisibleInAnalysis: false,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "type",
    name: "Type",
    type: "string",
    llm_prompt: "",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "note",
    name: "Note",
    type: "string",
    llm_prompt: "",
    isVisibleInList: false,
    isVisibleInAnalysis: false,
    isRequired: false,
    isExtra: false,
  },
  {
    code: "vat_rate",
    name: "VAT Rate",
    type: "number",
    llm_prompt: "VAT rate in percentage 0-100",
    isVisibleInList: false,
    isVisibleInAnalysis: false,
    isRequired: false,
    isExtra: true,
  },
  {
    code: "vat",
    name: "VAT Amount",
    type: "number",
    llm_prompt: "total VAT in currency of the invoice",
    isVisibleInList: false,
    isVisibleInAnalysis: false,
    isRequired: false,
    isExtra: true,
  },
  ...LEGACY_EXTRA_BILLING_DEFAULT_FIELDS,
  {
    code: "text",
    name: "Extracted Text",
    type: "string",
    llm_prompt: "extract all recognised text from the invoice",
    isVisibleInList: false,
    isVisibleInAnalysis: false,
    isRequired: false,
    isExtra: false,
  },
]

const DEFAULT_FIELD_LOCALIZATION: Partial<
  Record<(typeof LEGACY_DEFAULT_FIELDS)[number]["code"], { llm_prompt: string; name: string }>
> = {
  name: {
    name: "Nombre",
    llm_prompt: "nombre legible para personas; resume qué se ha comprado o pagado en la factura",
  },
  description: {
    name: "Descripción",
    llm_prompt: "descripción de la transacción",
  },
  merchant: {
    name: "Comercio",
    llm_prompt: "nombre del comercio o proveedor, usando la ortografía e idioma originales",
  },
  issuedAt: {
    name: "Fecha de emisión",
    llm_prompt: "fecha de emisión (formato YYYY-MM-DD)",
  },
  projectCode: {
    name: "Proyecto",
    llm_prompt: "código de proyecto, uno de: {projects.code}",
  },
  categoryCode: {
    name: "Categoría",
    llm_prompt: "código de categoría, uno de: {categories.code}",
  },
  files: {
    name: "Archivos",
    llm_prompt: "",
  },
  total: {
    name: "Total",
    llm_prompt: "importe total de la transacción",
  },
  currencyCode: {
    name: "Divisa",
    llm_prompt: "código de divisa ISO 4217 de tres letras, como USD o EUR, incluyendo códigos cripto como BTC o ETH",
  },
  convertedTotal: {
    name: "Total convertido",
    llm_prompt: "",
  },
  convertedCurrencyCode: {
    name: "Código de divisa convertida",
    llm_prompt: "",
  },
  type: {
    name: "Tipo",
    llm_prompt: "",
  },
  note: {
    name: "Nota",
    llm_prompt: "",
  },
  vat_rate: {
    name: "Tipo de IVA",
    llm_prompt: "porcentaje de IVA entre 0 y 100",
  },
  vat: {
    name: "Importe de IVA",
    llm_prompt: "importe total de IVA en la divisa de la factura",
  },
  invoice_number: {
    name: "Número de factura",
    llm_prompt: "número de factura, id de factura, número de documento o número de serie",
  },
  billing_company_name: {
    name: "Razón social de facturación",
    llm_prompt: "razón social completa del cliente facturado o nombre legal de la empresa facturada",
  },
  billing_tax_id: {
    name: "NIF/CIF de facturación",
    llm_prompt: "NIF, CIF, VAT number, identificador fiscal o número fiscal del cliente facturado",
  },
  billing_address: {
    name: "Dirección de facturación",
    llm_prompt: "dirección completa de facturación del cliente o empresa facturada",
  },
  billing_postal_code: {
    name: "Código postal de facturación",
    llm_prompt: "código postal o ZIP de facturación",
  },
  billing_city: {
    name: "Ciudad de facturación",
    llm_prompt: "ciudad o localidad de facturación",
  },
  billing_country: {
    name: "País de facturación",
    llm_prompt: "nombre del país o código de país de facturación",
  },
  text: {
    name: "Texto extraído",
    llm_prompt: "extrae todo el texto reconocido de la factura",
  },
}

export const DEFAULT_FIELDS = LEGACY_DEFAULT_FIELDS.map((field) => ({
  ...field,
  ...DEFAULT_FIELD_LOCALIZATION[field.code],
}))

const legacySettingsByCode = new Map(LEGACY_DEFAULT_SETTINGS.map((setting) => [setting.code, setting]))
const defaultSettingsByCode = new Map(DEFAULT_SETTINGS.map((setting) => [setting.code, setting]))
const legacyCategoriesByCode = new Map(LEGACY_DEFAULT_CATEGORIES.map((category) => [category.code, category]))
const defaultCategoriesByCode = new Map(DEFAULT_CATEGORIES.map((category) => [category.code, category]))
const legacyProjectsByCode = new Map(LEGACY_DEFAULT_PROJECTS.map((project) => [project.code, project]))
const defaultProjectsByCode = new Map(DEFAULT_PROJECTS.map((project) => [project.code, project]))
const legacyFieldsByCode = new Map(LEGACY_DEFAULT_FIELDS.map((field) => [field.code, field]))
const defaultFieldsByCode = new Map(DEFAULT_FIELDS.map((field) => [field.code, field]))

export async function createUserDefaults(userId: string) {
  // Default projects
  for (const project of DEFAULT_PROJECTS) {
    await prisma.project.upsert({
      where: { userId_code: { code: project.code, userId } },
      update: { name: project.name, color: project.color, llm_prompt: project.llm_prompt },
      create: { ...project, userId },
    })
  }

  // Default categories
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_code: { code: category.code, userId } },
      update: { name: category.name, color: category.color, llm_prompt: category.llm_prompt },
      create: { ...category, userId },
    })
  }

  // Default currencies
  for (const currency of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({
      where: { userId_code: { code: currency.code, userId } },
      update: { name: currency.name },
      create: { ...currency, userId },
    })
  }

  // Default fields
  for (const field of DEFAULT_FIELDS) {
    await prisma.field.upsert({
      where: { userId_code: { code: field.code, userId } },
      update: {
        name: field.name,
        type: field.type,
        llm_prompt: field.llm_prompt,
        isVisibleInList: field.isVisibleInList,
        isVisibleInAnalysis: field.isVisibleInAnalysis,
        isRequired: field.isRequired,
        isExtra: field.isExtra,
      },
      create: { ...field, userId },
    })
  }

  // Default settings
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { userId_code: { code: setting.code, userId } },
      update: { name: setting.name, description: setting.description, value: setting.value },
      create: { ...setting, userId },
    })
  }

  await prisma.setting.upsert({
    where: { userId_code: { code: DEFAULTS_SYNC_VERSION_SETTING_CODE, userId } },
    update: { value: String(DEFAULTS_SYNC_VERSION), name: "Versión de sincronización de defaults", description: "" },
    create: {
      code: DEFAULTS_SYNC_VERSION_SETTING_CODE,
      value: String(DEFAULTS_SYNC_VERSION),
      name: "Versión de sincronización de defaults",
      description: "",
      userId,
    },
  })
}

export async function isDatabaseEmpty(userId: string) {
  const fieldsCount = await prisma.field.count({ where: { userId } })
  return fieldsCount === 0
}

export async function ensureUserDefaultsVersion(userId: string) {
  const versionSetting = await prisma.setting.findUnique({
    where: { userId_code: { code: DEFAULTS_SYNC_VERSION_SETTING_CODE, userId } },
    select: { value: true },
  })

  if (versionSetting?.value === String(DEFAULTS_SYNC_VERSION)) {
    return
  }

  await prisma.$transaction(async (tx) => {
    const [existingFields, existingCategories, existingProjects, existingSettings] = await Promise.all([
      tx.field.findMany({
        where: { userId },
        select: { code: true, llm_prompt: true, name: true },
      }),
      tx.category.findMany({
        where: { userId },
        select: { code: true, llm_prompt: true, name: true },
      }),
      tx.project.findMany({
        where: { userId },
        select: { code: true, llm_prompt: true, name: true },
      }),
      tx.setting.findMany({
        where: { userId },
        select: { code: true, description: true, name: true, value: true },
      }),
    ])

    const missingFields = getMissingDefaultFields(existingFields.map((field) => field.code))
    const existingSettingsByCode = new Map(existingSettings.map((setting) => [setting.code, setting]))

    for (const field of missingFields) {
      await tx.field.upsert({
        where: { userId_code: { code: field.code, userId } },
        update: {},
        create: { ...field, userId },
      })
    }

    for (const field of existingFields) {
      const legacyField = legacyFieldsByCode.get(field.code)
      const defaultField = defaultFieldsByCode.get(field.code)

      if (!legacyField || !defaultField) {
        continue
      }

      const updateData: { llm_prompt?: string; name?: string } = {}

      if (field.name === legacyField.name) {
        updateData.name = defaultField.name
      }

      if (field.llm_prompt === legacyField.llm_prompt) {
        updateData.llm_prompt = defaultField.llm_prompt
      }

      if (Object.keys(updateData).length > 0) {
        await tx.field.update({
          where: { userId_code: { code: field.code, userId } },
          data: updateData,
        })
      }
    }

    for (const category of existingCategories) {
      const legacyCategory = legacyCategoriesByCode.get(category.code)
      const defaultCategory = defaultCategoriesByCode.get(category.code)

      if (!legacyCategory || !defaultCategory) {
        continue
      }

      const updateData: { llm_prompt?: string; name?: string } = {}

      if (category.name === legacyCategory.name) {
        updateData.name = defaultCategory.name
      }

      if (category.llm_prompt === legacyCategory.llm_prompt) {
        updateData.llm_prompt = defaultCategory.llm_prompt
      }

      if (Object.keys(updateData).length > 0) {
        await tx.category.update({
          where: { userId_code: { code: category.code, userId } },
          data: updateData,
        })
      }
    }

    for (const project of existingProjects) {
      const legacyProject = legacyProjectsByCode.get(project.code)
      const defaultProject = defaultProjectsByCode.get(project.code)

      if (!legacyProject || !defaultProject) {
        continue
      }

      const updateData: { llm_prompt?: string; name?: string } = {}

      if (project.name === legacyProject.name) {
        updateData.name = defaultProject.name
      }

      if (project.llm_prompt === legacyProject.llm_prompt) {
        updateData.llm_prompt = defaultProject.llm_prompt
      }

      if (Object.keys(updateData).length > 0) {
        await tx.project.update({
          where: { userId_code: { code: project.code, userId } },
          data: updateData,
        })
      }
    }

    for (const setting of existingSettings) {
      const legacySetting = legacySettingsByCode.get(setting.code)
      const defaultSetting = defaultSettingsByCode.get(setting.code)

      if (!legacySetting || !defaultSetting) {
        continue
      }

      const updateData: { description?: string; name?: string } = {}

      if (setting.name === legacySetting.name) {
        updateData.name = defaultSetting.name
      }

      if ((setting.description || "") === (legacySetting.description || "")) {
        updateData.description = defaultSetting.description
      }

      if (Object.keys(updateData).length > 0) {
        await tx.setting.update({
          where: { userId_code: { code: setting.code, userId } },
          data: updateData,
        })
      }
    }

    const promptSetting = existingSettingsByCode.get("prompt_analyse_new_file")

    if (shouldUpgradeDefaultAnalysisPrompt(promptSetting?.value)) {
      await tx.setting.upsert({
        where: { userId_code: { code: "prompt_analyse_new_file", userId } },
        update: {
          description:
            "Variables permitidas: {fields}, {categories}, {categories.code}, {projects}, {projects.code}",
          name: "Prompt del formulario de análisis de archivos",
          value: DEFAULT_PROMPT_ANALYSE_NEW_FILE,
        },
        create: {
          code: "prompt_analyse_new_file",
          name: "Prompt del formulario de análisis de archivos",
          description:
            "Variables permitidas: {fields}, {categories}, {categories.code}, {projects}, {projects.code}",
          value: DEFAULT_PROMPT_ANALYSE_NEW_FILE,
          userId,
        },
      })
    }

    await tx.setting.upsert({
      where: { userId_code: { code: DEFAULTS_SYNC_VERSION_SETTING_CODE, userId } },
      update: {
        value: String(DEFAULTS_SYNC_VERSION),
        name: "Versión de sincronización de defaults",
        description: "",
      },
      create: {
        code: DEFAULTS_SYNC_VERSION_SETTING_CODE,
        value: String(DEFAULTS_SYNC_VERSION),
        name: "Versión de sincronización de defaults",
        description: "",
        userId,
      },
    })
  })
}
