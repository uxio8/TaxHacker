import { prisma } from "@/lib/db"
import { incompleteTransactionFields, isTransactionIncomplete } from "@/lib/stats"
import { type Field, Prisma, type Transaction } from "@/prisma/client"
import { endOfQuarter, startOfQuarter } from "date-fns"
import { cache } from "react"
import { getFields } from "./fields"
import { deleteFile } from "./files"
import {
  buildTransactionOwnedCreateData,
  buildTransactionOwnedIdWhere,
  buildTransactionOwnedScope,
} from "./transaction-owned"

export type TransactionData = {
  name?: string | null
  description?: string | null
  merchant?: string | null
  total?: number | null
  currencyCode?: string | null
  convertedTotal?: number | null
  convertedCurrencyCode?: string | null
  type?: string | null
  items?: TransactionData[] | undefined
  note?: string | null
  files?: string[] | undefined
  extra?: Record<string, unknown>
  categoryCode?: string | null
  projectCode?: string | null
  issuedAt?: Date | string | null
  text?: string | null
  [key: string]: unknown
}

export const TRANSACTION_QUICK_VIEWS = {
  MISSING_CATEGORY: "missing_category",
  INCOMPLETE: "incomplete",
  PENDING_FISCAL: "pending_fiscal",
  CURRENT_QUARTER: "current_quarter",
} as const

export type TransactionQuickView = (typeof TRANSACTION_QUICK_VIEWS)[keyof typeof TRANSACTION_QUICK_VIEWS]

export type TransactionQuickViewOption = {
  code: TransactionQuickView
  label: string
  description: string
}

export const TRANSACTION_QUICK_VIEW_OPTIONS: TransactionQuickViewOption[] = [
  {
    code: TRANSACTION_QUICK_VIEWS.MISSING_CATEGORY,
    label: "Sin categoría",
    description: "Localiza movimientos que siguen sin clasificar.",
  },
  {
    code: TRANSACTION_QUICK_VIEWS.INCOMPLETE,
    label: "Incompletas",
    description: "Revisa registros con campos obligatorios pendientes.",
  },
  {
    code: TRANSACTION_QUICK_VIEWS.PENDING_FISCAL,
    label: "Pendientes fiscal",
    description: "Sube primero lo que sigue sin quedar listo para fiscal.",
  },
  {
    code: TRANSACTION_QUICK_VIEWS.CURRENT_QUARTER,
    label: "Este trimestre",
    description: "Enfoca el libro operativo en el trimestre activo.",
  },
]

export type TransactionFilters = {
  search?: string
  dateFrom?: string
  dateTo?: string
  ordering?: string
  categoryCode?: string
  projectCode?: string
  type?: string
  quickView?: TransactionQuickView
  page?: number
}

export type TransactionPagination = {
  limit: number
  offset: number
}

const TRANSACTION_PENDING_FISCAL_REVIEW_STATUSES = ["pending", "needs_review", "blocked"] as const

const TRANSACTION_ATTENTION_CODES = {
  MISSING_CATEGORY: "missing_category",
  INCOMPLETE: "incomplete",
  PENDING_FISCAL: "pending_fiscal",
} as const

type TransactionAttentionCode = (typeof TRANSACTION_ATTENTION_CODES)[keyof typeof TRANSACTION_ATTENTION_CODES]

export type TransactionAttentionSignal = {
  code: TransactionAttentionCode
  label: string
  description: string
  href: string
}

const transactionInclude = {
  category: true,
  project: true,
  fiscalDocument: true,
} satisfies Prisma.TransactionInclude

type TransactionRecordWithRelations = Prisma.TransactionGetPayload<{
  include: typeof transactionInclude
}>

export type TransactionListItem = Transaction & {
  category?: TransactionRecordWithRelations["category"]
  project?: TransactionRecordWithRelations["project"]
  fiscalDocument?: TransactionRecordWithRelations["fiscalDocument"]
}

type RawTransactionFilterValue = string | number | string[] | undefined

function getSingleFilterValue(value: RawTransactionFilterValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  if (typeof value === "number") {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function isTransactionQuickView(value: string | undefined): value is TransactionQuickView {
  return TRANSACTION_QUICK_VIEW_OPTIONS.some((option) => option.code === value)
}

export function getCurrentQuarterDateRange(referenceDate: Date = new Date()) {
  return {
    from: startOfQuarter(referenceDate),
    to: endOfQuarter(referenceDate),
  }
}

export function normalizeTransactionFilters(
  filters: Partial<Record<keyof TransactionFilters, RawTransactionFilterValue>>
): TransactionFilters {
  const pageValue = getSingleFilterValue(filters.page)
  const parsedPage = pageValue ? Number.parseInt(pageValue, 10) : Number.NaN
  const quickView = getSingleFilterValue(filters.quickView)

  return {
    search: getSingleFilterValue(filters.search),
    dateFrom: getSingleFilterValue(filters.dateFrom),
    dateTo: getSingleFilterValue(filters.dateTo),
    ordering: getSingleFilterValue(filters.ordering),
    categoryCode: getSingleFilterValue(filters.categoryCode),
    projectCode: getSingleFilterValue(filters.projectCode),
    type: getSingleFilterValue(filters.type),
    quickView: isTransactionQuickView(quickView) ? quickView : undefined,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : undefined,
  }
}

export function buildTransactionSearchParams(filters: Omit<TransactionFilters, "page">) {
  const searchParams = new URLSearchParams()

  if (filters.search) {
    searchParams.set("search", filters.search)
  }

  if (filters.dateFrom) {
    searchParams.set("dateFrom", filters.dateFrom)
  }

  if (filters.dateTo) {
    searchParams.set("dateTo", filters.dateTo)
  }

  if (filters.ordering) {
    searchParams.set("ordering", filters.ordering)
  }

  if (filters.categoryCode && filters.categoryCode !== "-") {
    searchParams.set("categoryCode", filters.categoryCode)
  }

  if (filters.projectCode && filters.projectCode !== "-") {
    searchParams.set("projectCode", filters.projectCode)
  }

  if (filters.type) {
    searchParams.set("type", filters.type)
  }

  if (filters.quickView) {
    searchParams.set("quickView", filters.quickView)
  }

  return searchParams
}

function getOrdering(filters?: TransactionFilters): Prisma.TransactionOrderByWithRelationInput {
  if (!filters?.ordering) {
    return { issuedAt: "desc" }
  }

  const isDesc = filters.ordering.startsWith("-")
  const field = isDesc ? filters.ordering.slice(1) : filters.ordering
  return { [field]: isDesc ? "desc" : "asc" }
}

function buildQuickViewClause(
  quickView: TransactionQuickView,
  referenceDate: Date = new Date()
): Prisma.TransactionWhereInput | null {
  if (quickView === TRANSACTION_QUICK_VIEWS.MISSING_CATEGORY) {
    return { categoryCode: null }
  }

  if (quickView === TRANSACTION_QUICK_VIEWS.PENDING_FISCAL) {
    return {
      fiscalDocument: {
        is: {
          reviewStatus: {
            in: [...TRANSACTION_PENDING_FISCAL_REVIEW_STATUSES],
          },
        },
      },
    }
  }

  if (quickView === TRANSACTION_QUICK_VIEWS.CURRENT_QUARTER) {
    const { from, to } = getCurrentQuarterDateRange(referenceDate)

    return {
      issuedAt: {
        gte: from,
        lte: to,
      },
    }
  }

  return null
}

function buildTransactionWhereInput(
  organizationId: string,
  filters?: TransactionFilters,
  referenceDate?: Date
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = buildTransactionOwnedScope(organizationId)
  const clauses: Prisma.TransactionWhereInput[] = []

  if (filters?.search) {
    clauses.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { merchant: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { note: { contains: filters.search, mode: "insensitive" } },
        { text: { contains: filters.search, mode: "insensitive" } },
      ],
    })
  }

  if (filters?.dateFrom || filters?.dateTo) {
    clauses.push({
      issuedAt: {
        gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
      },
    })
  }

  if (filters?.categoryCode && filters.categoryCode !== "-") {
    clauses.push({ categoryCode: filters.categoryCode })
  }

  if (filters?.projectCode && filters.projectCode !== "-") {
    clauses.push({ projectCode: filters.projectCode })
  }

  if (filters?.type) {
    clauses.push({ type: filters.type })
  }

  if (filters?.quickView) {
    const quickViewClause = buildQuickViewClause(filters.quickView, referenceDate)

    if (quickViewClause) {
      clauses.push(quickViewClause)
    }
  }

  if (clauses.length > 0) {
    where.AND = clauses
  }

  return where
}

function requiresIncompletePostFilter(filters?: TransactionFilters) {
  return filters?.quickView === TRANSACTION_QUICK_VIEWS.INCOMPLETE
}

function getFiscalReviewStatusLabel(status: string) {
  if (status === "blocked") {
    return "bloqueado"
  }

  if (status === "needs_review") {
    return "en revisión"
  }

  if (status === "pending") {
    return "pendiente"
  }

  return status
}

export function getTransactionAttentionSignals(
  transaction: Pick<TransactionListItem, "categoryCode" | "fiscalDocument"> & Transaction,
  fields: Field[]
): TransactionAttentionSignal[] {
  const signals: TransactionAttentionSignal[] = []

  if (!transaction.categoryCode) {
    signals.push({
      code: TRANSACTION_ATTENTION_CODES.MISSING_CATEGORY,
      label: "Sin categoría",
      description: "Asigna una categoría para que el movimiento quede clasificado en el libro.",
      href: "#transaction-edit",
    })
  }

  const missingFields = incompleteTransactionFields(fields, transaction)
  if (missingFields.length > 0) {
    signals.push({
      code: TRANSACTION_ATTENTION_CODES.INCOMPLETE,
      label: "Incompleta",
      description: `Completa estos campos obligatorios: ${missingFields.map((field) => field.name).join(", ")}.`,
      href: "#transaction-edit",
    })
  }

  const reviewStatus = transaction.fiscalDocument?.reviewStatus
  if (reviewStatus && reviewStatus !== "ready") {
    signals.push({
      code: TRANSACTION_ATTENTION_CODES.PENDING_FISCAL,
      label: "Pendiente fiscal",
      description: `El panel fiscal sigue ${getFiscalReviewStatusLabel(reviewStatus)} y necesita revisión antes de cerrar el registro.`,
      href: "#transaction-fiscal",
    })
  }

  return signals
}

export const getTransactions = cache(
  async (
    organizationId: string,
    filters?: TransactionFilters,
    pagination?: TransactionPagination
  ): Promise<{
    transactions: TransactionListItem[]
    total: number
  }> => {
    const where = buildTransactionWhereInput(organizationId, filters)
    const orderBy = getOrdering(filters)

    if (requiresIncompletePostFilter(filters)) {
      const [fields, transactions] = await Promise.all([
        getFields(organizationId),
        prisma.transaction.findMany({
          where,
          include: transactionInclude,
          orderBy,
        }),
      ])
      const filteredTransactions = transactions.filter((transaction) => isTransactionIncomplete(fields, transaction))

      if (!pagination) {
        return { transactions: filteredTransactions as TransactionListItem[], total: filteredTransactions.length }
      }

      return {
        transactions: filteredTransactions.slice(pagination.offset, pagination.offset + pagination.limit) as TransactionListItem[],
        total: filteredTransactions.length,
      }
    }

    if (pagination) {
      const total = await prisma.transaction.count({ where })
      const transactions = await prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy,
        take: pagination.limit,
        skip: pagination.offset,
      })

      return { transactions: transactions as TransactionListItem[], total }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy,
    })

    return { transactions: transactions as TransactionListItem[], total: transactions.length }
  }
)

export const getTransactionById = cache(
  async (id: string, organizationId: string): Promise<TransactionListItem | null> => {
    return (await prisma.transaction.findUnique({
      where: buildTransactionOwnedIdWhere(id, organizationId),
      include: transactionInclude,
    })) as TransactionListItem | null
  }
)

export const getTransactionsByFileId = cache(async (fileId: string, organizationId: string): Promise<Transaction[]> => {
  return prisma.transaction.findMany({
    where: { files: { array_contains: [fileId] }, ...buildTransactionOwnedScope(organizationId) },
  })
})

export const createTransaction = async (
  userId: string,
  organizationId: string,
  data: TransactionData
): Promise<Transaction> => {
  const { standard, extra } = await splitTransactionDataExtraFields(data, organizationId)

  return prisma.transaction.create({
    data: buildTransactionOwnedCreateData(userId, organizationId, {
      ...standard,
      extra,
      items: data.items as Prisma.InputJsonValue,
    }) as Prisma.TransactionUncheckedCreateInput,
  })
}

export const updateTransaction = async (
  id: string,
  organizationId: string,
  data: TransactionData
): Promise<Transaction> => {
  const { standard, extra } = await splitTransactionDataExtraFields(data, organizationId)

  return prisma.transaction.update({
    where: buildTransactionOwnedIdWhere(id, organizationId),
    data: {
      ...standard,
      extra,
      items: data.items ? (data.items as Prisma.InputJsonValue) : [],
    },
  })
}

export const updateTransactionFiles = async (
  id: string,
  organizationId: string,
  files: string[]
): Promise<Transaction> => {
  return prisma.transaction.update({
    where: buildTransactionOwnedIdWhere(id, organizationId),
    data: { files },
  })
}

export const deleteTransaction = async (id: string, organizationId: string): Promise<Transaction | undefined> => {
  const transaction = await getTransactionById(id, organizationId)

  if (!transaction) {
    return undefined
  }

  const files = Array.isArray(transaction.files) ? transaction.files : []

  for (const fileId of files as string[]) {
    if ((await getTransactionsByFileId(fileId, organizationId)).length <= 1) {
      await deleteFile(fileId, organizationId)
    }
  }

  return prisma.transaction.delete({
    where: buildTransactionOwnedIdWhere(id, organizationId),
  })
}

export const bulkDeleteTransactions = async (ids: string[], organizationId: string) => {
  return prisma.transaction.deleteMany({
    where: { id: { in: ids }, ...buildTransactionOwnedScope(organizationId) },
  })
}

const splitTransactionDataExtraFields = async (
  data: TransactionData,
  organizationId: string
): Promise<{ standard: TransactionData; extra: Prisma.InputJsonValue }> => {
  const fields = await getFields(organizationId)
  const fieldMap = fields.reduce(
    (acc, field) => {
      acc[field.code] = field
      return acc
    },
    {} as Record<string, Field>
  )

  const standard: TransactionData = {}
  const extra: Record<string, unknown> = {}

  Object.entries(data).forEach(([key, value]) => {
    const fieldDef = fieldMap[key]
    if (!fieldDef) {
      return
    }

    if (fieldDef.isExtra) {
      extra[key] = value
      return
    }

    standard[key] = value
  })

  return { standard, extra: extra as Prisma.InputJsonValue }
}
