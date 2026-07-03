import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AuthUser, ModuleId } from "@/types"

type AppSidebarProps = {
  activeModule: ModuleId
  currentUser: AuthUser
  roleCount: number
  permissionCount: number
  userCount: number
  isLoading: boolean
  onNavigate: (moduleId: ModuleId) => void
  onRefresh: () => void
  onLogout: () => void
}

const navigation = [
  {
    id: "dashboard",
    label: "Genel Bakış",
    icon: LayoutDashboard,
    enabled: true,
    permissions: [],
  },
  {
    id: "users",
    label: "Kullanıcılar",
    icon: Users,
    enabled: true,
    permissions: ["users.manage"],
  },
  {
    id: "roles",
    label: "Roller ve İzinler",
    icon: ShieldCheck,
    enabled: true,
    permissions: ["roles.manage"],
  },
  {
    id: "calls",
    label: "Çağrı Kayıtları",
    icon: ClipboardList,
    enabled: true,
    permissions: [
      "calls.view.own",
      "calls.view.all",
      "calls.create",
      "calls.edit",
      "calls.note.own",
      "calls.note.assigned",
      "calls.assign",
      "calls.resolve",
      "calls.reopen",
      "calls.archive",
    ],
  },
  {
    id: "reports",
    label: "Raporlar",
    icon: BarChart3,
    enabled: false,
    permissions: ["reports.view", "reports.export"],
  },
  {
    id: "settings",
    label: "Ayarlar",
    icon: Settings,
    enabled: true,
    permissions: ["settings.manage"],
  },
]

export function AppSidebar({
  activeModule,
  currentUser,
  roleCount,
  permissionCount,
  userCount,
  isLoading,
  onNavigate,
  onRefresh,
  onLogout,
}: AppSidebarProps) {
  const visibleNavigation = navigation.filter((item) => {
    if (item.id === "dashboard") {
      return true
    }

    return item.permissions.some((permission) => currentUser.permissions.includes(permission))
  })

  return (
    <aside className="sidebar">
      <div>
        <Badge variant="outline">Call Center</Badge>
        <h1>Yönetim Paneli</h1>
        <p>Menü, kullanıcının rolündeki modül izinlerine göre otomatik şekillenir.</p>
      </div>

      <nav className="module-nav" aria-label="Ana modüller">
        {visibleNavigation.map((item) => {
          const Icon = item.icon
          const isActive = item.id === activeModule

          return (
            <button
              key={item.id}
              type="button"
              className="module-nav-item"
              data-active={isActive}
              disabled={!item.enabled}
              onClick={() => item.enabled && onNavigate(item.id as ModuleId)}
            >
              <Icon />
              <span>{item.label}</span>
              {!item.enabled && <small>Yakında</small>}
            </button>
          )
        })}
      </nav>

      <div className="profile-box">
        <div className="avatar">{currentUser.fullName.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{currentUser.fullName}</strong>
          <span>{currentUser.roleName}</span>
        </div>
      </div>

      <div className="stat-grid">
        <div>
          <strong>{roleCount}</strong>
          <span>Rol</span>
        </div>
        <div>
          <strong>{permissionCount}</strong>
          <span>İzin</span>
        </div>
        <div>
          <strong>{userCount}</strong>
          <span>Kullanıcı</span>
        </div>
      </div>

      <div className="sidebar-actions">
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw />
          Yenile
        </Button>
        <Button type="button" variant="ghost" onClick={onLogout}>
          <LogOut />
          Çıkış
        </Button>
      </div>
    </aside>
  )
}
