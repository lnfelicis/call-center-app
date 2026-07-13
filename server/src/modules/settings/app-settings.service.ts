import type { AppSettingsRepository } from "./app-settings.repository.js";
import {
  appSettingDefaults,
  type SettingKey,
  type SettingValue,
} from "./app-settings.types.js";

export class AppSettingsService {
  constructor(private readonly repository: AppSettingsRepository) {}

  async read<T extends SettingKey>(key: T): Promise<SettingValue<T>> {
    const rawValue = await this.repository.readRaw(key);
    const parsedValue = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;

    return {
      ...appSettingDefaults[key],
      ...(parsedValue && typeof parsedValue === "object" ? parsedValue : {}),
    } as SettingValue<T>;
  }

  async write<T extends SettingKey>(
    key: T,
    value: Partial<SettingValue<T>>,
  ): Promise<SettingValue<T>> {
    const nextValue = {
      ...appSettingDefaults[key],
      ...value,
    } as SettingValue<T>;

    await this.repository.writeRaw(key, JSON.stringify(nextValue));

    return nextValue;
  }
}
