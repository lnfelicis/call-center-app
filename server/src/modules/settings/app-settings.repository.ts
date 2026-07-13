import type { RowDataPacket } from "mysql2";
import type { Database } from "../../database/database.js";
import type { SettingKey } from "./app-settings.types.js";

export class AppSettingsRepository {
  constructor(private readonly database: Database) {}

  async readRaw(key: SettingKey) {
    const [rows] = await this.database.query<Array<RowDataPacket & { setting_value: unknown }>>(
      "SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
      [key],
    );

    return rows[0]?.setting_value;
  }

  async writeRaw(key: SettingKey, value: string) {
    await this.database.query(
      `INSERT INTO app_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value],
    );
  }
}
