import { db } from "./db.js";
import type { RowDataPacket } from "mysql2";

export type NotificationSettings = {
  panelEnabled: boolean;
  emailEnabled: boolean;
  followUpReminderEnabled: boolean;
  urgentNotificationEnabled: boolean;
  staleCallNotificationEnabled: boolean;
  staleCallHours: number;
};

export type SecuritySettings = {
  sessionDurationMinutes: number;
  failedLoginLimit: number;
  ipAllowlist: string[];
};

export type PrivacySettings = {
  retentionDays: number;
  archiveResolvedAfterDays: number;
  anonymizeArchivedAfterDays: number;
};

export const defaultNotificationSettings: NotificationSettings = {
  panelEnabled: true,
  emailEnabled: false,
  followUpReminderEnabled: true,
  urgentNotificationEnabled: true,
  staleCallNotificationEnabled: true,
  staleCallHours: 24,
};

export const defaultSecuritySettings: SecuritySettings = {
  sessionDurationMinutes: 480,
  failedLoginLimit: 5,
  ipAllowlist: [],
};

export const defaultPrivacySettings: PrivacySettings = {
  retentionDays: 1095,
  archiveResolvedAfterDays: 180,
  anonymizeArchivedAfterDays: 365,
};

type SettingKey = "notification_settings" | "security_settings" | "privacy_settings";

const defaults = {
  notification_settings: defaultNotificationSettings,
  security_settings: defaultSecuritySettings,
  privacy_settings: defaultPrivacySettings,
};

export async function readAppSetting<T extends SettingKey>(key: T): Promise<(typeof defaults)[T]> {
  const [rows] = await db.query<Array<RowDataPacket & { setting_value: unknown }>>(
    "SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
    [key],
  );
  const rawValue = rows[0]?.setting_value;
  const parsedValue = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;

  return {
    ...defaults[key],
    ...(parsedValue && typeof parsedValue === "object" ? parsedValue : {}),
  };
}

export async function writeAppSetting<T extends SettingKey>(
  key: T,
  value: Partial<(typeof defaults)[T]>,
) {
  const nextValue = {
    ...defaults[key],
    ...value,
  };

  await db.query(
    `INSERT INTO app_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, JSON.stringify(nextValue)],
  );

  return nextValue;
}
