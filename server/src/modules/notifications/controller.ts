import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/types.js";
import type { AuditWriter } from "../audit/types.js";
import { serializeNotification } from "./mapper.js";
import type { NotificationService } from "./service.js";

export class NotificationController {
  constructor(
    private readonly service: NotificationService,
    private readonly audit: AuditWriter,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response) => {
    const rows = await this.service.listPanelNotifications(req.user?.id);

    res.json({ notifications: rows.map(serializeNotification) });
  };

  summary = async (req: AuthenticatedRequest, res: Response) => {
    const summary = await this.service.getPanelSummary(req.user?.id);

    res.json({
      unreadCount: summary.unreadCount,
      notifications: summary.notifications.map(serializeNotification),
    });
  };

  markRead = async (req: AuthenticatedRequest, res: Response) => {
    const notificationId = String(req.params.id ?? "");
    const affectedRows = await this.service.markRead(notificationId, req.user?.id);

    if (affectedRows === 0) {
      res.status(404).json({ message: "Bildirim bulunamadı." });
      return;
    }

    await this.audit({
      req,
      action: "notification.read",
      entityType: "notification",
      entityId: notificationId,
    });

    res.json({ ok: true });
  };
}
