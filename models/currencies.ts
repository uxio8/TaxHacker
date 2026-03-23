import { prisma } from "@/lib/db"
import { Prisma } from "@/prisma/client"
import { cache } from "react"
import { buildOrganizationOwnedCodeWhere, buildOrganizationOwnedCreateData, buildOrganizationOwnedScope } from "./organization-owned"

export type CurrencyData = {
  code: string
  name: string
}

export const getCurrencies = cache(async (organizationId: string) => {
  return await prisma.currency.findMany({
    where: buildOrganizationOwnedScope(organizationId),
    orderBy: {
      code: "asc",
    },
  })
})

export const createCurrency = async (organizationId: string, currency: CurrencyData) => {
  return await prisma.currency.create({
    data: buildOrganizationOwnedCreateData(organizationId, currency) as unknown as Prisma.CurrencyUncheckedCreateInput,
  })
}

export const updateCurrency = async (organizationId: string, code: string, currency: Prisma.CurrencyUpdateInput) => {
  return await prisma.currency.update({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
    data: currency,
  })
}

export const deleteCurrency = async (organizationId: string, code: string) => {
  return await prisma.currency.delete({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
  })
}
