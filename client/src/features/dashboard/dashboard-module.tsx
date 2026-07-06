import { useCallback, useEffect, useState } from "react"
import { ClipboardList, LayoutDashboard, ShieldCheck, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AdminDashboard, RequestFn } from "@/types"

type DashboardModuleProps = {
  userPermissions: string[]
  roleCount: number
  permissionCount: number
  userCount: number
  request: RequestFn
}

export function DashboardModule({
  userPermissions,
  roleCount,
  permissionCount,
  userCount,
  request,
}: DashboardModuleProps) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [message, setMessage] = useState("")
  const canViewAdminDashboard =
    userPermissions.includes("calls.view.all") ||
    userPermissions.includes("users.manage") ||
    userPermissions.includes("logs.view")

  const loadDashboard = useCallback(async () => {
    if (!canViewAdminDashboard) {
      return
    }

    try {
      const data = await request<AdminDashboard>("/admin/dashboard")
      setDashboard(data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dashboard verileri yüklenemedi.")
    }
  }, [canViewAdminDashboard, request])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const summaries = [
    userPermissions.includes("users.manage") ? (
      <span key="users" className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm">
        <Users className="size-4 text-primary" /> Kullanıcı Yönetimi aktif
      </span>
    ) : null,
    userPermissions.includes("roles.manage") ? (
      <span key="roles" className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm">
        <ShieldCheck className="size-4 text-primary" /> Roller ve İzinler aktif
      </span>
    ) : null,
    userPermissions.some((permission) => permission.startsWith("calls.")) ? (
      <span key="calls" className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm">
        <ClipboardList className="size-4 text-primary" /> Çağrı Kayıtları aktif
      </span>
    ) : null,
  ].filter(Boolean)

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      {message && (
        <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground xl:col-span-2">
          {message}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Modüler panel yapısı</CardTitle>
          <CardDescription>
            Kullanıcı, rol, çağrı ve ayar modülleri sidebar altında ayrı yönetilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {summaries.length > 0 ? summaries : (
              <span className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm">
                <LayoutDashboard className="size-4 text-primary" /> Yetkili modüller burada listelenir
              </span>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sistem özeti</CardTitle>
          <CardDescription>Panelde tanımlı mevcut kayıtlar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Kullanıcı" value={userCount} />
            <Metric label="Rol" value={roleCount} />
            <Metric label="İzin" value={permissionCount} />
          </div>
        </CardContent>
      </Card>
      {dashboard && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Yönetici Dashboard</CardTitle>
              <CardDescription>Çağrı operasyonu için anlık yönetim özeti.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                <Metric label="Toplam çağrı" value={dashboard.metrics.totalCalls} />
                <Metric label="Açık çağrı" value={dashboard.metrics.openCalls} />
                <Metric label="Takip bekleyen" value={dashboard.metrics.followUpCalls} />
                <Metric label="Aktif rol" value={dashboard.metrics.activeRoles} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {dashboard.callsByStatus.map((item) => (
                  <Badge key={item.status} variant="outline">
                    {item.status}: {item.total}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Son Hareketler</CardTitle>
              <CardDescription>Son çağrılar ve sistem logları.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                {dashboard.recentCalls.map((call) => (
                  <div key={call.id} className="rounded-lg border p-3">
                    <strong className="block text-sm font-medium">{call.recordNumber}</strong>
                    <span className="text-sm text-muted-foreground">
                      {call.openedByName} · {call.status} · {formatDate(call.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                {dashboard.recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span className="text-sm">{log.action}</span>
                    <Badge variant="outline">{log.actorUsername ?? "Sistem"}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <strong className="block text-2xl font-semibold">{value}</strong>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
