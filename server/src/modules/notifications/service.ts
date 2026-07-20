import type { NotificationSettings } from "../settings/app-settings.types.js";
import type { NotificationRepository } from "./repository.js";
import type { NotificationInput } from "./types.js";

export type NotificationServiceDependencies = {
  repository: NotificationRepository;
  readNotificationSettings: () => Promise<NotificationSettings>;
  generateId: () => string;
};

export class NotificationService {
  constructor(private readonly dependencies: NotificationServiceDependencies) {}

  getUsersWithAnyPermission(permissionIds: string[]) {
    return this.dependencies.repository.getUsersWithAnyPermission(permissionIds);
  }

  async createNotifications({
    userIds,
    title,
    message,
    type,
    entityType = null,
    entityId = null,
    entityLabel = null,
    dedupeKey = null,
  }: NotificationInput) {
    const uniqueUserIds = [...new Set(userIds)].filter(Boolean);

    if (uniqueUserIds.length === 0) {
      return;
    }

    const settings = await this.dependencies.readNotificationSettings();
    const channels = [
      settings.panelEnabled ? "panel" : null,
      settings.emailEnabled ? "email" : null,
    ].filter(Boolean) as Array<"panel" | "email">;

    if (channels.length === 0) {
      return;
    }

    for (const userId of uniqueUserIds) {
      for (const channel of channels) {
        const channelDedupeKey = dedupeKey ? `${dedupeKey}:${userId}:${channel}` : null;

        await this.dependencies.repository.insertNotification({
          id: this.dependencies.generateId(),
          userId,
          title,
          message,
          type,
          channel,
          entityType,
          entityId,
          entityLabel,
          dedupeKey: channelDedupeKey,
        });
      }
    }
  }

  async notifyUsersWithAnyPermission(
    permissionIds: string[],
    notification: Omit<NotificationInput, "userIds">,
  ) {
    const userIds = await this.getUsersWithAnyPermission(permissionIds);
    await this.createNotifications({ ...notification, userIds });
  }

  async generateOperationalNotifications() {
    const settings = await this.dependencies.readNotificationSettings();

    if (settings.followUpReminderEnabled) {
      const followUpRows = await this.dependencies.repository.findDueFollowUps();

      for (const call of followUpRows) {
        await this.createNotifications({
          userIds: [call.opened_by_user_id, call.assigned_to_user_id].filter(Boolean) as string[],
          title: "Takip tarihi gelen çağrı",
          message: `${call.record_number} numaralı çağrı için takip zamanı geldi.`,
          type: "call.follow_up_due",
          entityType: "call",
          entityId: call.id,
          entityLabel: call.record_number,
          dedupeKey: `follow-up-due:${call.id}`,
        });
      }
    }

    if (settings.staleCallNotificationEnabled) {
      const staleRows = await this.dependencies.repository.findStaleCalls(settings.staleCallHours);

      for (const call of staleRows) {
        await this.notifyUsersWithAnyPermission(["calls.view.all", "calls.resolve"], {
          title: "Çözüm bekleyen çağrı",
          message: `${call.record_number} numaralı çağrı belirlenen sürede çözülmedi.`,
          type: "call.stale",
          entityType: "call",
          entityId: call.id,
          entityLabel: call.record_number,
          dedupeKey: `stale-call:${call.id}:${settings.staleCallHours}`,
        });
      }
    }
  }

  async listPanelNotifications(userId: string | undefined) {
    await this.generateOperationalNotifications();
    return this.dependencies.repository.listPanelNotifications(userId);
  }

  markRead(notificationId: string, userId: string | undefined) {
    return this.dependencies.repository.markRead(notificationId, userId);
  }
}
