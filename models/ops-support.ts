import { listRecentPlatformAuditLogs, type PlatformAuditLogRecord } from "./platform-audit.ts"
import {
  listSupportAccessSessions,
  type SupportAccessSessionListRecord,
} from "./support-access.ts"

export const OPS_SUPPORT_DEFAULT_DURATION_HOURS = 2
export const OPS_SUPPORT_MAX_DURATION_HOURS = 8

export type OpsSupportTimelineItem =
  | {
      id: string
      kind: "session"
      occurredAt: Date
      title: string
      description: string
      mode: string
      active: boolean
    }
  | {
      id: string
      kind: "audit"
      occurredAt: Date
      title: string
      description: string
      action: string
    }

type OpsSupportDependencies = {
  listSupportAccessSessions?: typeof listSupportAccessSessions
  listRecentPlatformAuditLogs?: typeof listRecentPlatformAuditLogs
}

function buildSessionTitle(session: SupportAccessSessionListRecord) {
  const actorLabel = session.user?.name || session.user?.email || session.userId
  const assumedLabel = session.assumedUser
    ? session.assumedUser.name || session.assumedUser.email || session.assumedUser.id
    : null

  if (assumedLabel) {
    return `Actuando como ${assumedLabel}`
  }

  return `Soporte ${session.mode} por ${actorLabel}`
}

function buildAuditTitle(row: PlatformAuditLogRecord) {
  if (row.action === "support_impersonation.started") {
    return "Impersonación iniciada"
  }

  if (row.action === "support_impersonation.stopped") {
    return "Impersonación cerrada"
  }

  if (row.action === "support_access.created") {
    return "Sesión de soporte abierta"
  }

  if (row.action === "support_access.revoked") {
    return "Sesión de soporte revocada"
  }

  if (row.action === "organization.access_override.set") {
    return "Override de acceso aplicado"
  }

  if (row.action === "organization.access_override.cleared") {
    return "Override de acceso eliminado"
  }

  return row.action
}

export function buildOpsSupportTimeline(input: {
  sessions: SupportAccessSessionListRecord[]
  auditRows: PlatformAuditLogRecord[]
}) {
  const sessionItems: OpsSupportTimelineItem[] = input.sessions.map((session) => ({
    id: session.id,
    kind: "session",
    occurredAt: session.createdAt ?? session.expiresAt,
    title: buildSessionTitle(session),
    description: session.reason,
    mode: session.mode,
    active: !session.revokedAt && session.expiresAt > new Date(),
  }))

  const auditItems: OpsSupportTimelineItem[] = input.auditRows.map((row) => ({
    id: row.id,
    kind: "audit",
    occurredAt: row.createdAt,
    title: buildAuditTitle(row),
    description: row.reason || "Sin motivo explícito",
    action: row.action,
  }))

  return [...auditItems, ...sessionItems].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
}

export async function getOpsOrganizationSupport(
  organizationId: string,
  dependencies: OpsSupportDependencies = {}
) {
  const loadSessions = dependencies.listSupportAccessSessions ?? listSupportAccessSessions
  const loadAuditRows = dependencies.listRecentPlatformAuditLogs ?? listRecentPlatformAuditLogs

  const [activeSessions, recentSessions, auditRows] = await Promise.all([
    loadSessions({ organizationId, activeOnly: true, limit: 20 }),
    loadSessions({ organizationId, activeOnly: false, limit: 20 }),
    loadAuditRows({ organizationId, limit: 30 }),
  ])

  return {
    activeSessions,
    timeline: buildOpsSupportTimeline({
      sessions: recentSessions,
      auditRows: auditRows.filter((row) =>
        row.action.startsWith("support_") || row.action.startsWith("organization.access_override")
      ),
    }),
    guardrails: {
      defaultDurationHours: OPS_SUPPORT_DEFAULT_DURATION_HOURS,
      maxDurationHours: OPS_SUPPORT_MAX_DURATION_HOURS,
      actorAlwaysVisible: true,
      reasonRequired: true,
    },
  }
}
