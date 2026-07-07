import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../auth.js";
import { writeAuditLog } from "../audit.js";
import { db } from "../db.js";
import { generateOperationalNotifications } from "../notifications.js";

type NotificationRow = RowDataPacket & {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  channel: "panel" | "email";
  entity_type: string | null;
  entity_id: string | null;
  is_read: 0 | 1;
  read_at: string | null;
  created_at: string;
};

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

notificationRoutes.get(
  "/notifications",
  requirePermission("notifications.view"),
  async (req: AuthenticatedRequest, res) => {
    await generateOperationalNotifications();

    const [rows] = await db.query<NotificationRow[]>(
      `SELECT id, title, message, notification_type, channel, entity_type, entity_id, is_read, read_at, created_at
      FROM notifications
      WHERE user_id = ? AND channel = 'panel'
      ORDER BY is_read ASC, created_at DESC
      LIMIT 100`,
      [req.user?.id],
    );

    res.json({
      notifications: rows.map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        type: row.notification_type,
        channel: row.channel,
        entityType: row.entity_type,
        entityId: row.entity_id,
        isRead: row.is_read === 1,
        readAt: row.read_at,
        createdAt: row.created_at,
      })),
    });
  },
);

notificationRoutes.patch(
  "/notifications/:id/read",
  requirePermission("notifications.view"),
  async (req: AuthenticatedRequest, res) => {
    const notificationId = String(req.params.id ?? "");
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE notifications
      SET is_read = 1, read_at = NOW()
      WHERE id = ? AND user_id = ?`,
      [notificationId, req.user?.id],
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ message: "Bildirim bulunamadı." });
      return;
    }

    await writeAuditLog({
      req,
      action: "notification.read",
      entityType: "notification",
      entityId: notificationId,
    });

    res.json({ ok: true });
  },
);
