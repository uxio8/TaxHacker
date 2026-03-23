export const TAX_WORKSPACE_ROUTE = "/tax"

export type TaxWorkspaceModuleId = "quarters" | "review" | "forms" | "archive" | "close"
export type TaxWorkspaceQuickLinkId = "transactions" | "unsorted"
export type TaxWorkspaceModuleStatus = "available" | "upcoming"

export interface TaxWorkspaceModule {
  id: TaxWorkspaceModuleId
  href: string
  status: TaxWorkspaceModuleStatus
}

export interface TaxWorkspaceQuickLink {
  id: TaxWorkspaceQuickLinkId
  href: string
}

export const TAX_WORKSPACE_MODULES: TaxWorkspaceModule[] = [
  {
    id: "quarters",
    href: `${TAX_WORKSPACE_ROUTE}/quarters`,
    status: "available",
  },
  {
    id: "review",
    href: `${TAX_WORKSPACE_ROUTE}/review`,
    status: "available",
  },
  {
    id: "forms",
    href: `${TAX_WORKSPACE_ROUTE}/forms`,
    status: "available",
  },
  {
    id: "archive",
    href: `${TAX_WORKSPACE_ROUTE}/archive`,
    status: "available",
  },
  {
    id: "close",
    href: `${TAX_WORKSPACE_ROUTE}/close`,
    status: "available",
  },
]

export const TAX_WORKSPACE_QUICK_LINKS: TaxWorkspaceQuickLink[] = [
  {
    id: "transactions",
    href: "/transactions",
  },
  {
    id: "unsorted",
    href: "/unsorted",
  },
]
