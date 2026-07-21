export type AuthUser = {
  id: string
  username: string
  fullName: string
  email: string
  roleId: string
  roleName: string
  permissions: string[]
}

export type Permission = {
  id: string
  groupName: string
  label: string
  description: string | null
}

export type PermissionOverride = {
  permissionId: string
  effect: "allow" | "deny"
}

export type Role = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  createdAt: string
  permissions: string[]
}

export type ManagedUser = {
  id: string
  username: string
  fullName: string
  email: string
  status: "active" | "passive"
  roleId: string
  roleName: string
  createdAt: string
  lastLoginAt: string | null
  archivedAt: string | null
  permissionOverrides: PermissionOverride[]
  permissions: string[]
}

export type RoleForm = {
  name: string
  description: string
  permissions: string[]
}

export type UserForm = {
  username: string
  fullName: string
  email: string
  password: string
  roleId: string
  permissionOverrides: PermissionOverride[]
}

export type ModuleId =
  | "dashboard"
  | "users"
  | "roles"
  | "calls"
  | "reports"
  | "notifications"
  | "logs"
  | "settings"

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>

export type OperationError = {
  message: string
  field?: string
}

export type OperationResult =
  | { ok: true }
  | { ok: false; error: OperationError }

export type ThemeMode = "light" | "dark" | "system"

export type CallPriority = string

export type CallStatus =
  string

export type CallRecord = {
  id: string
  recordNumber: string
  phoneNumber: string
  studentTc: string | null
  studentName: string | null
  interactionType: string
  category: string
  subCategory: string | null
  issue: string
  initialNote: string | null
  priority: CallPriority
  status: CallStatus
  needsFollowUp: boolean
  followUpAt: string | null
  openedByUserId: string
  openedByName: string
  assignedToUserId: string | null
  assignedToName: string | null
  resolvedByUserId: string | null
  resolvedByName: string | null
  resolvedAt: string | null
  resolutionDescription: string | null
  resolutionCategory: string | null
  isLocked: boolean
  createdAt: string
  updatedAt: string
}

export type CallMatches = {
  matches: CallRecord[]
  matchedBy: "phone-and-tc" | "tc" | "phone" | null
}

export type CallNote = {
  id: string
  callId: string
  authorUserId: string
  authorName: string
  noteType: string
  content: string
  createdAt: string
}

export type CallEvent = {
  id: string
  callId: string
  actorUserId: string | null
  actorName: string | null
  eventType: string
  description: string
  metadata: unknown
  createdAt: string
}

export type CallDetail = {
  call: CallRecord
  notes: CallNote[]
  events: CallEvent[]
}

export type CallForm = {
  phoneNumber: string
  studentTc: string
  studentName: string
  interactionType: string
  category: string
  issue: string
  initialNote: string
  priority: CallPriority
  needsFollowUp: boolean
  followUpAt: string
}

export type CreateCallPayload = CallForm & {
  assignedToUserId?: string | null
}

export type UserOption = {
  id: string
  fullName: string
  username: string
}

export type CallOptionType =
  | "interaction_type"
  | "issue_category"
  | "issue_sub_category"
  | "status"
  | "priority"
  | "resolution_category"

export type CallFormOption = {
  id: string
  type: CallOptionType
  label: string
  value: string
  color: string | null
  isActive: boolean
  sortOrder: number
}

export type CallFormFieldSetting = {
  key: keyof CallForm | "needsFollowUp"
  label: string
  isActive: boolean
  isRequired: boolean
  isVisible: boolean
  isEditable: boolean
  isMasked: boolean
  sortOrder: number
}

export type AuditLog = {
  id: string
  actorUserId: string | null
  actorUsername: string | null
  action: string
  entityType: string
  entityId: string | null
  entityLabel: string | null
  metadata: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export type AdminDashboard = {
  metrics: {
    totalCalls: number
    openCalls: number
    followUpCalls: number
    totalUsers: number
    activeRoles: number
  }
  callsByStatus: Array<{ status: string; total: number }>
  recentCalls: Array<{
    id: string
    recordNumber: string
    status: string
    priority: string
    openedByName: string
    resolvedAt: string | null
    createdAt: string
  }>
  recentLogs: Array<{
    id: string
    actorUsername: string | null
    action: string
    entityType: string
    createdAt: string
  }>
}

export type ReportCall = {
  id: string
  recordNumber: string
  phoneNumber: string
  studentTc: string | null
  studentName: string | null
  interactionType: string
  category: string
  priority: string
  status: string
  needsFollowUp: boolean
  followUpAt: string | null
  openedByUserId: string
  openedByName: string
  assignedToUserId: string | null
  assignedToName: string | null
  resolvedByUserId: string | null
  resolvedByName: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ReportsSummary = {
  summary: {
    total: number
    open: number
    resolved: number
    followUp: number
    urgent: number
  }
  byStatus: Array<{ label: string; total: number }>
  byPriority: Array<{ label: string; total: number }>
}

export type StaffReport = {
  userId: string
  fullName: string
  openedTotal: number
  resolvedTotal: number
}

export type CategoryReport = {
  category: string
  total: number
  openTotal: number
  resolvedTotal: number
}

export type ReportExport = {
  fileName: string
  mimeType: string
  content: string
}

export type AppNotification = {
  id: string
  title: string
  message: string
  type: string
  channel: "panel" | "email"
  entityType: string | null
  entityId: string | null
  entityLabel: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export type SecuritySettings = {
  sessionDurationMinutes: number
  failedLoginLimit: number
  ipAllowlist: string[]
}

export type NotificationSettings = {
  panelEnabled: boolean
  emailEnabled: boolean
  followUpReminderEnabled: boolean
  urgentNotificationEnabled: boolean
  staleCallNotificationEnabled: boolean
  staleCallHours: number
}

export type PrivacySettings = {
  retentionDays: number
  archiveResolvedAfterDays: number
  anonymizeArchivedAfterDays: number
}
