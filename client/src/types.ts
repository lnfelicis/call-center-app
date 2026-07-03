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
}

export type ModuleId = "dashboard" | "users" | "roles" | "calls" | "settings"

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>

export type CallPriority = "low" | "normal" | "high" | "urgent"

export type CallStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "follow_up"
  | "transferred"
  | "resolved"
  | "closed"
  | "cancelled"
  | "duplicate"
  | "archived"

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

export type UserOption = {
  id: string
  fullName: string
  username: string
}

export type CallOptionType = "interaction_type" | "issue_category"

export type CallFormOption = {
  id: string
  type: CallOptionType
  label: string
  isActive: boolean
  sortOrder: number
}
