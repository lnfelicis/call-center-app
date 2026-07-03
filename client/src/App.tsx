import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { ClipboardList, LayoutDashboard, ShieldCheck, Users } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { LoginScreen } from "@/components/login-screen"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CallsModule } from "@/features/calls/calls-module"
import { RolesModule } from "@/features/roles/roles-module"
import { SettingsModule } from "@/features/settings/settings-module"
import { UsersModule } from "@/features/users/users-module"
import { isPasswordValid } from "@/lib/password"
import type {
  AuthUser,
  ManagedUser,
  ModuleId,
  Permission,
  RequestFn,
  Role,
  RoleForm,
  UserForm,
} from "@/types"
import "./App.css"

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

const emptyRoleForm: RoleForm = {
  name: "",
  description: "",
  permissions: [],
}

const emptyUserForm: UserForm = {
  username: "",
  fullName: "",
  email: "",
  password: "",
  roleId: "",
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("call-center-token") ?? "")
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard")
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [loginForm, setLoginForm] = useState({ username: "superadmin", password: "Admin12345!" })
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm)
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0]
  const permissionsByGroup = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      groups[permission.groupName] = [...(groups[permission.groupName] ?? []), permission]
      return groups
    }, {})
  }, [permissions])

  const request: RequestFn = async <T,>(path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    const data = (await response.json().catch(() => ({}))) as { message?: string }

    if (!response.ok) {
      throw new Error(data.message ?? "İşlem tamamlanamadı.")
    }

    return data as T
  }

  async function loadPanelData(activeToken = token) {
    if (!activeToken) {
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const headers = { Authorization: `Bearer ${activeToken}` }
      const meData = await fetch(`${apiBaseUrl}/auth/me`, { headers }).then((res) => res.json())

      if (meData.message) {
        throw new Error(meData.message)
      }

      const userPermissions = (meData.user?.permissions ?? []) as string[]
      const canManageRoles = userPermissions.includes("roles.manage")
      const canManageUsers = userPermissions.includes("users.manage")
      const canManageSettings = userPermissions.includes("settings.manage")
      const canUseCalls = userPermissions.some((permission) => permission.startsWith("calls."))
      const [permissionData, roleData, userData] = await Promise.all([
        canManageRoles
          ? fetch(`${apiBaseUrl}/permissions`, { headers }).then((res) => res.json())
          : Promise.resolve({ permissions: [] }),
        canManageRoles || canManageUsers
          ? fetch(`${apiBaseUrl}/roles`, { headers }).then((res) => res.json())
          : Promise.resolve({ roles: [] }),
        canManageUsers
          ? fetch(`${apiBaseUrl}/users`, { headers }).then((res) => res.json())
          : Promise.resolve({ users: [] }),
      ])

      if (permissionData.message || roleData.message || userData.message) {
        throw new Error(permissionData.message ?? roleData.message ?? userData.message)
      }

      setCurrentUser(meData.user)
      setPermissions(permissionData.permissions)
      setRoles(roleData.roles)
      setUsers(userData.users)
      setSelectedRoleId((current) => current || roleData.roles[0]?.id || "")
      setUserForm((current) => ({
        ...current,
        roleId: current.roleId || roleData.roles[0]?.id || "",
      }))
      setActiveModule((current) => {
        if (current === "users" && !canManageUsers) {
          return "dashboard"
        }

        if (current === "roles" && !canManageRoles) {
          return "dashboard"
        }

        if (current === "calls" && !canUseCalls) {
          return "dashboard"
        }

        if (current === "settings" && !canManageSettings) {
          return "dashboard"
        }

        return current
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Veriler yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      void loadPanelData(token)
    }
  }, [token])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      const data = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      }).then((response) => response.json())

      if (!data.token) {
        throw new Error(data.message ?? "Giriş yapılamadı.")
      }

      localStorage.setItem("call-center-token", data.token)
      setToken(data.token)
      setCurrentUser(data.user)
      setMessage("Giriş başarılı.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Giriş yapılamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem("call-center-token")
    setToken("")
    setCurrentUser(null)
    setPermissions([])
    setRoles([])
    setUsers([])
  }

  function toggleNewRolePermission(permissionId: string) {
    setRoleForm((current) => {
      const exists = current.permissions.includes(permissionId)
      return {
        ...current,
        permissions: exists
          ? current.permissions.filter((id) => id !== permissionId)
          : [...current.permissions, permissionId],
      }
    })
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage("")

    if (roleForm.permissions.length === 0) {
      setMessage("Rol oluşturmak için en az bir izin seçin.")
      setIsLoading(false)
      return
    }

    try {
      await request("/roles", {
        method: "POST",
        body: JSON.stringify(roleForm),
      })
      setRoleForm(emptyRoleForm)
      setMessage("Rol oluşturuldu.")
      await loadPanelData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rol oluşturulamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  async function saveSelectedRolePermissions() {
    if (!selectedRole) {
      return
    }

    if (selectedRole.permissions.length === 0) {
      setMessage("Rol üzerinde en az bir izin kalmalıdır.")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      await request(`/roles/${selectedRole.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: selectedRole.permissions }),
      })
      setMessage("Rol izinleri kaydedildi.")
      await loadPanelData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rol izinleri kaydedilemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  function toggleSelectedRolePermission(permissionId: string) {
    if (!selectedRole) {
      return
    }

    setRoles((current) =>
      current.map((role) => {
        if (role.id !== selectedRole.id) {
          return role
        }

        const exists = role.permissions.includes(permissionId)

        return {
          ...role,
          permissions: exists
            ? role.permissions.filter((id) => id !== permissionId)
            : [...role.permissions, permissionId],
        }
      }),
    )
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage("")

    if (!isPasswordValid(userForm.password)) {
      setMessage("Şifre gereksinimleri karşılanmadan kullanıcı oluşturulamaz.")
      setIsLoading(false)
      return
    }

    try {
      await request("/users", {
        method: "POST",
        body: JSON.stringify(userForm),
      })
      setUserForm({ ...emptyUserForm, roleId: roles[0]?.id ?? "" })
      setMessage("Kullanıcı oluşturuldu.")
      await loadPanelData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kullanıcı oluşturulamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token || !currentUser) {
    return (
      <LoginScreen
        form={loginForm}
        message={message}
        isLoading={isLoading}
        onChange={setLoginForm}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <main className="app-shell">
      <AppSidebar
        activeModule={activeModule}
        currentUser={currentUser}
        roleCount={roles.length}
        permissionCount={permissions.length}
        userCount={users.length}
        isLoading={isLoading}
        onNavigate={setActiveModule}
        onRefresh={() => void loadPanelData()}
        onLogout={handleLogout}
      />

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p>Yönetim</p>
            <h2>{getModuleTitle(activeModule)}</h2>
          </div>
          {message && <Badge variant="secondary">{message}</Badge>}
        </header>

        {activeModule === "dashboard" && (
          <DashboardModule
            userPermissions={currentUser.permissions}
            roleCount={roles.length}
            permissionCount={permissions.length}
            userCount={users.length}
          />
        )}

        {activeModule === "users" && (
          <UsersModule
            users={users}
            roles={roles}
            userForm={userForm}
            isLoading={isLoading}
            onUserFormChange={setUserForm}
            onCreateUser={createUser}
          />
        )}

        {activeModule === "roles" && (
          <RolesModule
            permissionsByGroup={permissionsByGroup}
            roles={roles}
            selectedRole={selectedRole}
            selectedRoleId={selectedRole?.id ?? ""}
            roleForm={roleForm}
            isLoading={isLoading}
            onRoleFormChange={setRoleForm}
            onSelectRole={setSelectedRoleId}
            onCreateRole={createRole}
            onToggleNewRolePermission={toggleNewRolePermission}
            onToggleSelectedRolePermission={toggleSelectedRolePermission}
            onSaveSelectedRolePermissions={() => void saveSelectedRolePermissions()}
          />
        )}

        {activeModule === "calls" && (
          <CallsModule
            currentUser={currentUser}
            request={request}
          />
        )}

        {activeModule === "settings" && (
          <SettingsModule request={request} />
        )}
      </section>
    </main>
  )
}

function getModuleTitle(moduleId: ModuleId) {
  if (moduleId === "users") {
    return "Kullanıcı Yönetimi"
  }

  if (moduleId === "roles") {
    return "Roller ve İzinler"
  }

  if (moduleId === "calls") {
    return "Çağrı Kayıtları"
  }

  if (moduleId === "settings") {
    return "Ayarlar"
  }

  return "Genel Bakış"
}

function DashboardModule({
  userPermissions,
  roleCount,
  permissionCount,
  userCount,
}: {
  userPermissions: string[]
  roleCount: number
  permissionCount: number
  userCount: number
}) {
  const summaries = [
    userPermissions.includes("users.manage") ? <span key="users"><Users /> Kullanıcı Yönetimi aktif</span> : null,
    userPermissions.includes("roles.manage") ? <span key="roles"><ShieldCheck /> Roller ve İzinler aktif</span> : null,
    userPermissions.some((permission) => permission.startsWith("calls."))
      ? <span key="calls"><ClipboardList /> Çağrı Kayıtları sonraki faz</span>
      : null,
  ].filter(Boolean)

  return (
    <div className="dashboard-grid">
      <Card>
        <CardHeader>
          <CardTitle>Modüler panel yapısı</CardTitle>
          <CardDescription>
            Kullanıcı ve rol modülleri ayrıldı. Sonraki fazlarda çağrı kayıtları,
            raporlar, bildirimler ve ayarlar aynı sidebar altında açılacak.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="module-summary-list">
            {summaries.length > 0 ? summaries : <span><LayoutDashboard /> Yetkili modüller burada listelenir</span>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sistem özeti</CardTitle>
          <CardDescription>Faz 1 ve Faz 2 kapsamındaki mevcut kayıtlar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overview-metrics">
            <div>
              <strong>{userCount}</strong>
              <span>Kullanıcı</span>
            </div>
            <div>
              <strong>{roleCount}</strong>
              <span>Rol</span>
            </div>
            <div>
              <strong>{permissionCount}</strong>
              <span>İzin</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
