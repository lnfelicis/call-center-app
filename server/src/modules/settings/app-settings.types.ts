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

export const appSettingDefaults = {
  notification_settings: defaultNotificationSettings,
  security_settings: defaultSecuritySettings,
  privacy_settings: defaultPrivacySettings,
};

export type SettingKey = keyof typeof appSettingDefaults;
export type SettingValue<T extends SettingKey> = (typeof appSettingDefaults)[T];
