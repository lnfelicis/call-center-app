import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { NotificationRepository } from "./modules/notifications/repository.js";
import { NotificationService } from "./modules/notifications/service.js";
import { readAppSetting } from "./settings.js";

export type { NotificationInput } from "./modules/notifications/types.js";
export { NotificationRepository } from "./modules/notifications/repository.js";
export { NotificationService } from "./modules/notifications/service.js";

export const notificationService = new NotificationService({
  repository: new NotificationRepository(db),
  readNotificationSettings: () => readAppSetting("notification_settings"),
  generateId: randomUUID,
});

export const getUsersWithAnyPermission = (permissionIds: string[]) =>
  notificationService.getUsersWithAnyPermission(permissionIds);

export const createNotifications = (
  input: import("./modules/notifications/types.js").NotificationInput,
) => notificationService.createNotifications(input);

export const notifyUsersWithAnyPermission = (
  permissionIds: string[],
  notification: Omit<import("./modules/notifications/types.js").NotificationInput, "userIds">,
) => notificationService.notifyUsersWithAnyPermission(permissionIds, notification);

export const generateOperationalNotifications = () =>
  notificationService.generateOperationalNotifications();
