import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import { DataTable } from "@/components/data-table"
import type { DataTableColumn } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AuditLog, RequestFn } from "@/types"

type LogsModuleProps = {
  request: RequestFn
}

const actionLabels: Record<string, string> = {
  "auth.login": "Oturum açıldı",
  "auth.logout": "Oturum kapatıldı",
  "user.create": "Kullanıcı oluşturuldu",
  "user.update": "Kullanıcı güncellendi",
  "role.create": "Rol oluşturuldu",
  "role.update": "Rol güncellendi",
  "role.permissions.update": "Rol izinleri güncellendi",
  "call.create": "Çağrı kaydı oluşturuldu",
  "call.update": "Çağrı bilgileri güncellendi",
  "call.status.update": "Çağrı durumu güncellendi",
  "call.note.create": "Çağrı notu eklendi",
  "call.assign": "Çağrı ataması güncellendi",
  "call.resolve": "Çağrı çözüldü",
  "call.reopen": "Çağrı yeniden açıldı",
  "settings.update": "Ayarlar güncellendi",
  "settings.option.create": "Ayar seçeneği eklendi",
  "settings.option.update": "Ayar seçeneği güncellendi",
  "call_option.create": "Çağrı formu seçeneği eklendi",
  "call_option.update": "Çağrı formu seçeneği güncellendi",
  "call_option.bulk_update": "Çağrı formu seçenekleri toplu güncellendi",
  "seed.super_admin": "Süper Admin seed edildi",
}

const entityLabels: Record<string, string> = {
  call: "Çağrı",
  user: "Kullanıcı",
  role: "Rol",
  settings: "Ayarlar",
  call_form_option: "Form seçeneği",
}

const fieldLabels: Record<string, string> = {
  phoneNumber: "Telefon",
  studentTc: "Öğrenci TC",
  studentName: "Öğrenci",
  interactionType: "Görüşme tipi",
  category: "Sorun kategorisi",
  issue: "Yaşanılan sorun",
  initialNote: "İlk not",
  priority: "Öncelik",
  needsFollowUp: "Takip gerekiyor",
  followUpAt: "Takip tarihi",
}

export function LogsModule({ request }: LogsModuleProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const columns = useMemo<Array<DataTableColumn<AuditLog>>>(
    () => [
      {
        id: "createdAt",
        header: "Tarih",
        enableHiding: false,
        size: 150,
        minSize: 120,
        maxSize: 220,
        className: "whitespace-nowrap",
        accessor: (log) => formatDate(log.createdAt),
        cell: (log) => formatDate(log.createdAt),
      },
      {
        id: "actor",
        header: "Kullanıcı",
        size: 150,
        minSize: 120,
        maxSize: 260,
        accessor: (log) => log.actorUsername ?? "Sistem",
        cell: (log) => <Badge variant="outline">{log.actorUsername ?? "Sistem"}</Badge>,
      },
      {
        id: "action",
        header: "İşlem",
        size: 230,
        minSize: 160,
        maxSize: 420,
        accessor: (log) => `${actionLabels[log.action] ?? log.action} ${log.action}`,
        cell: (log) => (
          <div>
            <strong className="block font-medium text-foreground">{actionLabels[log.action] ?? log.action}</strong>
            <span className="mt-1 block text-xs text-muted-foreground">{log.action}</span>
          </div>
        ),
      },
      {
        id: "entity",
        header: "Kayıt",
        size: 150,
        minSize: 120,
        maxSize: 260,
        accessor: (log) => `${entityLabels[log.entityType] ?? log.entityType} ${log.entityId ?? ""}`,
        cell: (log) => (
          <div>
            <span className="block">{entityLabels[log.entityType] ?? log.entityType}</span>
            {log.entityId && <span className="text-xs">{log.entityId.slice(0, 8)}</span>}
          </div>
        ),
      },
      {
        id: "description",
        header: "Açıklama",
        size: 360,
        minSize: 220,
        maxSize: 720,
        accessor: (log) => describeLog(log),
        cell: (log) => <span className="leading-6">{describeLog(log)}</span>,
      },
      {
        id: "ipAddress",
        header: "IP",
        size: 140,
        minSize: 100,
        maxSize: 220,
        accessor: (log) => log.ipAddress ?? "",
        cell: (log) => log.ipAddress ?? "-",
      },
    ],
    [],
  )

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setMessage("")

    try {
      const data = await request<{ logs: AuditLog[] }>("/logs")
      setLogs(data.logs)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Log kayıtları yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Log Kayıtları</CardTitle>
          <CardDescription>
            Sistemdeki kullanıcı, rol, çağrı ve ayar değişikliklerinin anlaşılır işlem dökümü.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadLogs()} disabled={isLoading}>
          <RefreshCw />
          Yenile
        </Button>
      </CardHeader>
      <CardContent>
        {message && (
          <p className="mb-3 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">{message}</p>
        )}
        <DataTable
          columns={columns}
          data={logs}
          getRowId={(log) => log.id}
          emptyText="Henüz log kaydı yok."
          searchPlaceholder="Loglarda ara..."
        />
      </CardContent>
    </Card>
  )
}

function describeLog(log: AuditLog) {
  const metadata = normalizeMetadata(log.metadata)

  if (log.action === "call.update") {
    const updatedFields = asStringArray(metadata.updatedFields)
    return updatedFields.length > 0
      ? `Değişen alanlar: ${updatedFields.map((field) => fieldLabels[field] ?? field).join(", ")}.`
      : "Çağrı bilgilerinde değişiklik yapıldı."
  }

  if (log.action === "settings.update") {
    return `${Number(metadata.fieldCount ?? 0)} form alanı ve ${Number(metadata.optionCount ?? 0)} seçenek kaydedildi.`
  }

  if (log.action.includes("option")) {
    const label = typeof metadata.label === "string" ? metadata.label : null
    const type = typeof metadata.type === "string" ? metadata.type : null
    return [label, type].filter(Boolean).join(" / ") || "Form seçeneği değiştirildi."
  }

  if (log.action === "user.create" || log.action === "user.update") {
    const email = typeof metadata.email === "string" ? metadata.email : null
    const status = typeof metadata.status === "string" ? metadata.status : null
    return [email, status ? `Durum: ${status}` : null].filter(Boolean).join(" · ") || "Kullanıcı kaydı değişti."
  }

  if (log.action === "role.permissions.update") {
    const permissionCount = Number(metadata.permissionCount ?? metadata.count ?? 0)
    return permissionCount > 0 ? `${permissionCount} izin kaydedildi.` : "Rol izinleri değiştirildi."
  }

  if (log.action === "call.status.update") {
    return typeof metadata.status === "string" ? `Yeni durum: ${metadata.status}.` : "Çağrı durumu değiştirildi."
  }

  if (log.action === "call.resolve") {
    return typeof metadata.resolutionCategory === "string"
      ? `Çözüm kategorisi: ${metadata.resolutionCategory}.`
      : "Çağrı çözüldü."
  }

  if (log.action === "call.create") {
    return typeof metadata.recordNumber === "string" ? `Kayıt no: ${metadata.recordNumber}.` : "Yeni çağrı kaydı açıldı."
  }

  return summarizeMetadata(metadata)
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata) {
    return {}
  }

  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata) as unknown
      return normalizeMetadata(parsed)
    } catch {
      return { detail: metadata }
    }
  }

  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }

  return { detail: metadata }
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function summarizeMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata)

  if (entries.length === 0) {
    return "Ek detay yok."
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(" · ")
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ")
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value ?? "-")
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
