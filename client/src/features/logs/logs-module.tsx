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
  "auth.login.blocked": "Oturum açma denemesi engellendi",
  "auth.logout": "Oturum kapatıldı",
  "user.create": "Kullanıcı oluşturuldu",
  "user.update": "Kullanıcı güncellendi",
  "user.archive": "Kullanıcı arşivlendi",
  "user.restore": "Kullanıcı geri yüklendi",
  "user.password.change": "Kullanıcı şifresini değiştirdi",
  "user.password.reset": "Kullanıcı şifresi sıfırlandı",
  "user.permission_overrides.update": "Kullanıcı izinleri güncellendi",
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
  "settings.security.update": "Güvenlik ve bildirim ayarları güncellendi",
  "settings.option.create": "Ayar seçeneği eklendi",
  "settings.option.update": "Ayar seçeneği güncellendi",
  "call_option.create": "Çağrı formu seçeneği eklendi",
  "call_option.update": "Çağrı formu seçeneği güncellendi",
  "call_option.bulk_update": "Çağrı formu seçenekleri toplu güncellendi",
  "notification.read": "Bildirim okundu olarak işaretlendi",
  "reports.export": "Rapor dışa aktarıldı",
  "seed.super_admin": "Süper Admin seed edildi",
}

const entityLabels: Record<string, string> = {
  call: "Çağrı",
  user: "Kullanıcı",
  role: "Rol",
  settings: "Ayarlar",
  call_form_option: "Form seçeneği",
  notification: "Bildirim",
  report: "Rapor",
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
  status: "Durum",
  isActive: "Aktiflik",
  noteType: "Not tipi",
  resolutionCategory: "Çözüm kategorisi",
  format: "Dosya biçimi",
  rowCount: "Kayıt sayısı",
  count: "Adet",
  label: "Ad",
  type: "Tür",
}

const statusLabels: Record<string, string> = {
  active: "Aktif",
  passive: "Pasif",
  open: "Açık",
  in_progress: "İşlemde",
  waiting: "Yanıt bekliyor",
  follow_up: "Takip edilecek",
  transferred: "Yetkiliye aktarıldı",
  pending: "Bekliyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
  archived: "Arşiv",
  cancelled: "İptal",
  duplicate: "Mükerrer",
}

const optionTypeLabels: Record<string, string> = {
  interaction_type: "Görüşme tipi",
  issue_category: "Sorun kategorisi",
  issue_sub_category: "Sorun alt kategorisi",
  status: "Durum",
  priority: "Öncelik",
  resolution_category: "Çözüm kategorisi",
}

const noteTypeLabels: Record<string, string> = {
  personnel: "Personel notu",
  follow_up: "Takip notu",
  assigned_personnel: "Atanan personel notu",
  internal: "İç not",
  manager: "Yönetici notu",
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
        accessor: (log) => `${getActionLabel(log.action)} ${log.action}`,
        cell: (log) => <span className="font-medium text-foreground">{getActionLabel(log.action)}</span>,
      },
      {
        id: "entity",
        header: "Kayıt",
        size: 150,
        minSize: 120,
        maxSize: 260,
        accessor: (log) => `${entityLabels[log.entityType] ?? "Kayıt"} ${log.entityLabel ?? ""}`,
        cell: (log) => (
          <span>
            {entityLabels[log.entityType] ?? "Kayıt"}
            {log.entityLabel ? ` · ${log.entityLabel}` : ""}
          </span>
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

  if (log.action === "user.permission_overrides.update") {
    const roleName = asNonEmptyString(metadata.roleName)
    const grantedCount = asCount(metadata.grantedPermissionCount, metadata.grantedPermissions)
    const deniedCount = asCount(metadata.deniedPermissionCount, metadata.deniedPermissions)
    const overrideCount = grantedCount + deniedCount
    return [roleName ? `Rol: ${roleName}` : null, `${overrideCount} özel izin`]
      .filter(Boolean)
      .join(" · ")
  }

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
    return [label, type ? optionTypeLabels[type] ?? type : null].filter(Boolean).join(" · ") || "Form seçeneği değiştirildi."
  }

  if (log.action === "user.create" || log.action === "user.update") {
    const email = typeof metadata.email === "string" ? metadata.email : null
    const status = typeof metadata.status === "string" ? metadata.status : null
    return [email, status ? `Durum: ${translateStatus(status)}` : null].filter(Boolean).join(" · ") || "Kullanıcı kaydı değişti."
  }

  if (log.action === "user.archive") {
    return "Kullanıcı arşive taşındı."
  }

  if (log.action === "user.restore") {
    return "Kullanıcı yeniden etkin kayıtlara alındı."
  }

  if (log.action === "user.password.change") {
    return "Kullanıcı kendi şifresini değiştirdi ve açık oturumları kapatıldı."
  }

  if (log.action === "user.password.reset") {
    return "Kullanıcının şifresi yönetici tarafından sıfırlandı ve açık oturumları kapatıldı."
  }

  if (log.action === "role.permissions.update") {
    const permissionCount = asCount(metadata.permissionCount, metadata.permissions)
    return permissionCount > 0 ? `${permissionCount} izin kaydedildi.` : "Rol izinleri değiştirildi."
  }

  if (log.action === "role.create" || log.action === "role.update") {
    const name = asNonEmptyString(metadata.name)
    const isActive = typeof metadata.isActive === "boolean" ? metadata.isActive : null
    return [name ? `Rol: ${name}` : null, isActive === null ? null : `Durum: ${isActive ? "Aktif" : "Pasif"}`]
      .filter(Boolean)
      .join(" · ") || "Rol bilgileri değiştirildi."
  }

  if (log.action === "call.status.update") {
    return typeof metadata.status === "string" ? `Yeni durum: ${translateStatus(metadata.status)}.` : "Çağrı durumu değiştirildi."
  }

  if (log.action === "call.resolve") {
    return typeof metadata.resolutionCategory === "string"
      ? `Çözüm kategorisi: ${metadata.resolutionCategory}.`
      : "Çağrı çözüldü."
  }

  if (log.action === "call.create") {
    return typeof metadata.recordNumber === "string" ? `Kayıt no: ${metadata.recordNumber}.` : "Yeni çağrı kaydı açıldı."
  }

  if (log.action === "call.assign") {
    const previous = asNonEmptyString(metadata.previousAssignedToName) ?? "Atanmamış"
    const next = asNonEmptyString(metadata.assignedToName) ?? "Atanmamış"
    return `Atama: ${previous} → ${next}.`
  }

  if (log.action === "call.note.create") {
    const noteType = asNonEmptyString(metadata.noteType)
    return noteType ? `Not tipi: ${noteTypeLabels[noteType] ?? "Çağrı notu"}.` : "Çağrı kaydına not eklendi."
  }

  if (log.action === "call.reopen") {
    return "Çözülen çağrı yeniden açıldı."
  }

  if (log.action === "auth.login") {
    return "Kullanıcı başarıyla oturum açtı."
  }

  if (log.action === "auth.logout") {
    return "Kullanıcı oturumunu kapattı."
  }

  if (log.action === "auth.login.blocked") {
    return "Başarısız giriş sınırı aşıldı."
  }

  if (log.action === "reports.export") {
    const format = String(metadata.format ?? "").toLocaleUpperCase("tr-TR")
    const rowCount = Number(metadata.rowCount ?? 0)
    return `${format || "Rapor"} dosyasına ${rowCount} kayıt aktarıldı.`
  }

  if (log.action === "notification.read") {
    return "Bildirim okundu olarak işaretlendi."
  }

  if (log.action === "settings.security.update") {
    return "Güvenlik, bildirim ve gizlilik ayarları kaydedildi."
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
  const entries = Object.entries(metadata).filter(([key]) => !isTechnicalMetadataKey(key))

  if (entries.length === 0) {
    return "Ek detay yok."
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${fieldLabels[key] ?? humanizeKey(key)}: ${formatValue(value, key)}`)
    .join(" · ")
}

function formatValue(value: unknown, key?: string): string {
  if (Array.isArray(value)) {
    return `${value.length} öğe`
  }

  if (value && typeof value === "object") {
    return "Detay kaydedildi"
  }

  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır"
  }

  if (typeof value === "string" && key?.toLocaleLowerCase("tr-TR").includes("status")) {
    return translateStatus(value)
  }

  return String(value ?? "-")
}

function getActionLabel(action: string) {
  const label = actionLabels[action] ?? "Sistem işlemi gerçekleştirildi"
  return label.endsWith(".") ? label : `${label}.`
}

function translateStatus(status: string) {
  return statusLabels[status] ?? status
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null
}

function asCount(value: unknown, fallback: unknown) {
  const count = Number(value)
  if (Number.isFinite(count)) {
    return count
  }
  return Array.isArray(fallback) ? fallback.length : 0
}

function isTechnicalMetadataKey(key: string) {
  const normalized = key.toLocaleLowerCase("tr-TR")
  return normalized.endsWith("id") || normalized.endsWith("ids") || normalized.includes("permission")
}

function humanizeKey(key: string) {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim()
  return spaced ? `${spaced.charAt(0).toLocaleUpperCase("tr-TR")}${spaced.slice(1)}` : "Detay"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
