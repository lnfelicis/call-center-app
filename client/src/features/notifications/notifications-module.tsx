import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, CheckCheck, RefreshCw } from "lucide-react"

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
import type { AppNotification, RequestFn } from "@/types"

type NotificationsModuleProps = {
  request: RequestFn
}

const notificationTypeLabels: Record<string, string> = {
  "call.urgent": "Acil çağrı",
  "call.follow_up_due": "Takip zamanı gelen çağrı",
  "call.stale": "Çözüm bekleyen çağrı",
}

const entityLabels: Record<string, string> = {
  call: "Çağrı",
  user: "Kullanıcı",
  role: "Rol",
  notification: "Bildirim",
}

export function NotificationsModule({ request }: NotificationsModuleProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    setMessage("")

    try {
      const data = await request<{ notifications: AppNotification[] }>("/notifications")
      setNotifications(data.notifications)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bildirimler yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const markAsRead = useCallback(async (notificationId: string) => {
    setIsLoading(true)
    setMessage("")

    try {
      await request(`/notifications/${notificationId}/read`, { method: "PATCH" })
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification,
        ),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bildirim okundu yapılamadı.")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  const columns = useMemo<Array<DataTableColumn<AppNotification>>>(
    () => [
      {
        id: "state",
        header: "Durum",
        size: 110,
        cell: (notification) => (
          <Badge variant={notification.isRead ? "secondary" : "default"}>
            {notification.isRead ? "Okundu" : "Yeni"}
          </Badge>
        ),
        accessor: (notification) => (notification.isRead ? "Okundu" : "Yeni"),
      },
      {
        id: "title",
        header: "Bildirim",
        size: 360,
        cell: (notification) => (
          <div className="grid gap-1">
            <span className="font-medium text-foreground">{notification.title}</span>
            <span className="whitespace-normal text-sm">{notification.message}</span>
          </div>
        ),
        accessor: (notification) => `${notification.title} ${notification.message}`,
      },
      {
        id: "type",
        header: "Tip",
        size: 180,
        cell: (notification) => notificationTypeLabels[notification.type] ?? "Sistem bildirimi",
        accessor: (notification) => `${notificationTypeLabels[notification.type] ?? "Sistem bildirimi"} ${notification.type}`,
      },
      {
        id: "entity",
        header: "Kayıt",
        size: 160,
        cell: (notification) => formatEntity(notification),
        accessor: (notification) => `${notification.entityType ?? ""} ${notification.entityLabel ?? ""}`,
      },
      {
        id: "createdAt",
        header: "Tarih",
        size: 170,
        cell: (notification) => formatDate(notification.createdAt),
        accessor: (notification) => notification.createdAt,
      },
      {
        id: "actions",
        header: "İşlem",
        size: 130,
        enableHiding: false,
        cell: (notification) =>
          notification.isRead ? (
            <span className="text-xs text-muted-foreground">Tamam</span>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => void markAsRead(notification.id)}>
              <CheckCheck />
              Okundu
            </Button>
          ),
      },
    ],
    [markAsRead],
  )

  return (
    <div className="grid gap-4">
      {message && <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">{message}</p>}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5" />
              Bildirimler
            </CardTitle>
            <CardDescription>Takip, acil kayıt ve çözüm süresi bildirimleri burada görünür.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={unreadCount > 0 ? "default" : "secondary"}>{unreadCount} okunmamış</Badge>
            <Button type="button" variant="outline" onClick={() => void loadNotifications()} disabled={isLoading}>
              <RefreshCw />
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={notifications} getRowId={(notification) => notification.id} emptyText="Bildirim bulunmuyor." searchPlaceholder="Bildirimlerde ara..." />
        </CardContent>
      </Card>
    </div>
  )
}

function formatEntity(notification: AppNotification) {
  if (!notification.entityType) {
    return "-"
  }

  const typeLabel = entityLabels[notification.entityType] ?? "Kayıt"
  return notification.entityLabel ? `${typeLabel} · ${notification.entityLabel}` : typeLabel
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
