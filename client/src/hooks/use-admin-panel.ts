import { useCallback, useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"

import { useToast } from "@/hooks/use-toast"
import { ApiRequestError, toOperationError } from "@/lib/api-error"
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
  permissionOverrides: [],
}

export function useAdminPanel() {
  const toast = useToast()
  const [token, setToken] = useState(() => localStorage.getItem("call-center-token") ?? "")
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard")
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm)
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm)
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionRestoring, setIsSessionRestoring] = useState(() =>
    Boolean(localStorage.getItem("call-center-token")),
  )
  const [authMessage, setAuthMessage] = useState("")
  const [panelError, setPanelError] = useState("")

  const clearSession = useCallback((nextMessage = "") => {
    localStorage.removeItem("call-center-token")
    setToken("")
    setCurrentUser(null)
    setPermissions([])
    setRoles([])
    setUsers([])
    setIsSessionRestoring(false)
    setAuthMessage(nextMessage)
    setPanelError("")
  }, [])

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0]
  const permissionsByGroup = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      groups[permission.groupName] = [...(groups[permission.groupName] ?? []), permission]
      return groups
    }, {})
  }, [permissions])

  const request: RequestFn = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })

      const data = (await response.json().catch(() => ({}))) as {
        message?: string
        field?: string
      }

      if (response.status === 401 && token) {
        clearSession(data.message ?? "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.")
      }

      if (!response.ok) {
        throw new ApiRequestError(data.message ?? "İşlem tamamlanamadı.", data.field)
      }

      return data as T
    },
    [clearSession, token],
  )

  const loadPanelData = useCallback(
    async (activeToken = token) => {
      if (!activeToken) {
        setIsSessionRestoring(false)
        return
      }

      setIsLoading(true)
      setPanelError("")
      let identityLoaded = false

      try {
        const headers = { Authorization: `Bearer ${activeToken}` }
        const fetchPanelData = async (path: string) => {
          const response = await fetch(`${apiBaseUrl}${path}`, { headers })
          const data = await response.json().catch(() => ({}))

          if (response.status === 401) {
            clearSession(data.message ?? "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.")
          }

          if (!response.ok) {
            throw new Error(data.message ?? "Veriler yüklenemedi.")
          }

          return data
        }
        const meData = await fetchPanelData("/auth/me")

        if (meData.message) {
          throw new Error(meData.message)
        }

        setCurrentUser(meData.user)
        identityLoaded = true

        const userPermissions = (meData.user?.permissions ?? []) as string[]
        const canManageRoles = userPermissions.includes("roles.manage")
        const canManageUsers = userPermissions.includes("users.manage")
        const canManageSettings = userPermissions.includes("settings.manage")
        const canViewLogs = userPermissions.includes("logs.view")
        const canViewReports = userPermissions.includes("reports.view") || userPermissions.includes("reports.export")
        const canViewNotifications = userPermissions.includes("notifications.view")
        const canUseCalls = userPermissions.some((permission) => permission.startsWith("calls."))
        const [permissionData, roleData, userData] = await Promise.all([
          canManageRoles || canManageUsers
            ? fetchPanelData("/permissions")
            : Promise.resolve({ permissions: [] }),
          canManageRoles || canManageUsers
            ? fetchPanelData("/roles")
            : Promise.resolve({ roles: [] }),
          canManageUsers || canViewReports
            ? fetchPanelData(`/${canManageUsers ? "users?scope=all" : "users/options"}`)
            : Promise.resolve({ users: [] }),
        ])

        if (permissionData.message || roleData.message || userData.message) {
          throw new Error(permissionData.message ?? roleData.message ?? userData.message)
        }

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

          if (current === "logs" && !canViewLogs) {
            return "dashboard"
          }

          if (current === "reports" && !canViewReports) {
            return "dashboard"
          }

          if (current === "notifications" && !canViewNotifications) {
            return "dashboard"
          }

          return current
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Veriler yüklenemedi."
        if (identityLoaded) setPanelError(errorMessage)
        else setAuthMessage(errorMessage)
      } finally {
        setIsSessionRestoring(false)
        setIsLoading(false)
      }
    },
    [clearSession, token],
  )

  useEffect(() => {
    if (token) {
      void loadPanelData(token)
      return
    }

    setIsSessionRestoring(false)
  }, [loadPanelData, token])

  useEffect(() => {
    if (!token || !currentUser) {
      return
    }

    const validateSession = () => {
      void request("/auth/me").catch(() => undefined)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        validateSession()
      }
    }
    const intervalId = window.setInterval(validateSession, 60_000)

    window.addEventListener("focus", validateSession)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", validateSession)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [currentUser, request, token])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setAuthMessage("")

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
      setAuthMessage("")
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Giriş yapılamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogout() {
    clearSession()
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

    if (roleForm.permissions.length === 0) {
      setIsLoading(false)
      return {
        ok: false as const,
        error: { message: "Rol oluşturmak için en az bir izin seçin." },
      }
    }

    try {
      await request("/roles", {
        method: "POST",
        body: JSON.stringify(roleForm),
      })
      setRoleForm(emptyRoleForm)
      toast.success("Rol oluşturuldu.")
      await loadPanelData()
      return { ok: true as const }
    } catch (error) {
      return { ok: false as const, error: toOperationError(error, "Rol oluşturulamadı.") }
    } finally {
      setIsLoading(false)
    }
  }

  async function saveSelectedRolePermissions() {
    if (!selectedRole) {
      return { ok: false as const, error: { message: "Rol seçilmedi." } }
    }

    if (selectedRole.permissions.length === 0) {
      return {
        ok: false as const,
        error: { message: "Rol üzerinde en az bir izin kalmalıdır." },
      }
    }

    setIsLoading(true)

    try {
      await request(`/roles/${selectedRole.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: selectedRole.permissions }),
      })
      toast.success("İzinler kaydedildi.")
      await loadPanelData()
      return { ok: true as const }
    } catch (error) {
      return {
        ok: false as const,
        error: toOperationError(error, "Rol izinleri kaydedilemedi."),
      }
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

    if (!isPasswordValid(userForm.password)) {
      setIsLoading(false)
      return {
        ok: false as const,
        error: {
          message: "Şifre gereksinimleri karşılanmadan kullanıcı oluşturulamaz.",
          field: "password",
        },
      }
    }

    try {
      await request("/users", {
        method: "POST",
        body: JSON.stringify(userForm),
      })
      setUserForm({ ...emptyUserForm, roleId: roles[0]?.id ?? "" })
      toast.success("Kullanıcı oluşturuldu.")
      await loadPanelData()
      return { ok: true as const }
    } catch (error) {
      return { ok: false as const, error: toOperationError(error, "Kullanıcı oluşturulamadı.") }
    } finally {
      setIsLoading(false)
    }
  }

  async function updateUser(
    userId: string,
    payload: Pick<
      ManagedUser,
      "fullName" | "email" | "roleId" | "status" | "permissionOverrides"
    >,
  ) {
    setIsLoading(true)

    try {
      await request(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
      toast.success("Kullanıcı güncellendi.")
      await loadPanelData()
      return { ok: true as const }
    } catch (error) {
      return { ok: false as const, error: toOperationError(error, "Kullanıcı güncellenemedi.") }
    } finally {
      setIsLoading(false)
    }
  }

  async function changePassword(
    userId: string,
    payload: { currentPassword?: string; newPassword: string },
  ) {
    setIsLoading(true)

    try {
      await request(`/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })

      if (userId === currentUser?.id) {
        clearSession("Şifreniz değiştirildi. Lütfen yeni şifrenizle tekrar giriş yapın.")
      } else {
        toast.success("Kullanıcının şifresi sıfırlandı.")
      }
      return { ok: true as const }
    } catch (error) {
      return { ok: false as const, error: toOperationError(error, "Şifre değiştirilemedi.") }
    } finally {
      setIsLoading(false)
    }
  }

  async function archiveUser(userId: string) {
    setIsLoading(true)

    try {
      await request(`/users/${userId}`, { method: "DELETE" })
      toast.success("Kullanıcı silindi.")
      await loadPanelData()
      return { ok: true as const }
    } catch (error) {
      return { ok: false as const, error: toOperationError(error, "Kullanıcı silinemedi.") }
    } finally {
      setIsLoading(false)
    }
  }

  async function restoreUser(userId: string) {
    setIsLoading(true)

    try {
      await request(`/users/${userId}/restore`, { method: "POST" })
      toast.success("Kullanıcı geri yüklendi.")
      await loadPanelData()
      return { ok: true as const }
    } catch (error) {
      return {
        ok: false as const,
        error: toOperationError(error, "Kullanıcı geri yüklenemedi."),
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    activeModule,
    currentUser,
    isAuthenticated: Boolean(token && currentUser),
    isLoading,
    isSessionRestoring,
    loginForm,
    authMessage,
    panelError,
    permissions,
    permissionsByGroup,
    request,
    roleForm,
    roles,
    selectedRole,
    userForm,
    users,
    createRole,
    createUser,
    updateUser,
    changePassword,
    archiveUser,
    restoreUser,
    handleLogin,
    handleLogout,
    loadPanelData,
    saveSelectedRolePermissions,
    setActiveModule,
    setLoginForm,
    setRoleForm,
    setSelectedRoleId,
    setUserForm,
    toggleNewRolePermission,
    toggleSelectedRolePermission,
  }
}
