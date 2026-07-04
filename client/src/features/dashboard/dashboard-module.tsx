import { ClipboardList, LayoutDashboard, ShieldCheck, Users } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type DashboardModuleProps = {
  userPermissions: string[]
  roleCount: number
  permissionCount: number
  userCount: number
}

export function DashboardModule({
  userPermissions,
  roleCount,
  permissionCount,
  userCount,
}: DashboardModuleProps) {
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
