import { db } from "./db.js";
import { AppSettingsRepository } from "./modules/settings/app-settings.repository.js";
import { AppSettingsService } from "./modules/settings/app-settings.service.js";

export type {
  NotificationSettings,
  PrivacySettings,
  SecuritySettings,
  SettingKey,
  SettingValue,
} from "./modules/settings/app-settings.types.js";
export {
  appSettingDefaults,
  defaultNotificationSettings,
  defaultPrivacySettings,
  defaultSecuritySettings,
} from "./modules/settings/app-settings.types.js";
export { AppSettingsRepository } from "./modules/settings/app-settings.repository.js";
export { AppSettingsService } from "./modules/settings/app-settings.service.js";

export const appSettingsService = new AppSettingsService(new AppSettingsRepository(db));

export const readAppSetting = <
  T extends import("./modules/settings/app-settings.types.js").SettingKey,
>(
  key: T,
) => appSettingsService.read(key);

export const writeAppSetting = <
  T extends import("./modules/settings/app-settings.types.js").SettingKey,
>(
  key: T,
  value: Partial<import("./modules/settings/app-settings.types.js").SettingValue<T>>,
) => appSettingsService.write(key, value);
