import { useCallback, useEffect, useState } from "react"

import type { AppNotification, RequestFn } from "@/types"

type NotificationSummary = {
  unreadCount: number
  notifications: AppNotification[]
}

export function useNotificationCenter({
  request,
  enabled,
}: {
  request: RequestFn
  enabled: boolean
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) {
      return
    }

    const summary = await request<NotificationSummary>("/notifications/summary")
    setNotifications(summary.notifications)
    setUnreadCount(summary.unreadCount)
  }, [enabled, request])

  const markAsRead = useCallback(async (notification: AppNotification) => {
    if (notification.isRead) {
      return
    }

    await request(`/notifications/${notification.id}/read`, { method: "PATCH" })
    const readAt = new Date().toISOString()
    setNotifications((current) => current.map((item) =>
      item.id === notification.id ? { ...item, isRead: true, readAt } : item,
    ))
    setUnreadCount((current) => Math.max(0, current - 1))
  }, [request])

  useEffect(() => {
    if (!enabled) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    const refreshSafely = () => {
      void refresh().catch(() => undefined)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSafely()
      }
    }

    refreshSafely()
    const intervalId = window.setInterval(refreshSafely, 30_000)
    window.addEventListener("focus", refreshSafely)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refreshSafely)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, refresh])

  return { notifications, unreadCount, markAsRead, refresh }
}
