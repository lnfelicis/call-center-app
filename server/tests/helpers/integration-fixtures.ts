import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import { assertSafeTestDatabaseName } from "./test-database.js";

export const superAdminRoleId = "00000000-0000-4000-8000-000000000001";
export const superAdminUserId = "00000000-0000-4000-8000-000000000002";

export const dueFollowUpCall = {
  id: "10000000-0000-4000-8000-000000000001",
  recordNumber: "INT-000001",
};

const defaultSecuritySettings = {
  sessionDurationMinutes: 480,
  failedLoginLimit: 5,
  ipAllowlist: [],
};

const defaultNotificationSettings = {
  panelEnabled: true,
  emailEnabled: false,
  followUpReminderEnabled: true,
  urgentNotificationEnabled: true,
  staleCallNotificationEnabled: true,
  staleCallHours: 24,
};

const defaultPrivacySettings = {
  retentionDays: 1095,
  archiveResolvedAfterDays: 180,
  anonymizeArchivedAfterDays: 365,
};

type IntegrationDatabase = Pick<Pool, "query" | "getConnection">;

export async function writeJsonSetting(
  database: IntegrationDatabase,
  key: string,
  value: Record<string, unknown>,
) {
  assertSafeTestDatabaseName();
  await database.query(
    `INSERT INTO app_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, JSON.stringify(value)],
  );
}

export async function resetIntegrationState(database: IntegrationDatabase) {
  assertSafeTestDatabaseName();
  const connection = await database.getConnection();

  try {
    await connection.beginTransaction();

    // FK-safe order: leaf records first, then their call/user parents.
    await connection.query("DELETE FROM notifications");
    await connection.query("DELETE FROM audit_logs");
    await connection.query("DELETE FROM call_events");
    await connection.query("DELETE FROM call_notes");
    await connection.query("DELETE FROM call_records");
    await connection.query("DELETE FROM users WHERE id <> ?", [superAdminUserId]);
    await connection.query("DELETE FROM role_permissions WHERE role_id <> ?", [
      superAdminRoleId,
    ]);
    await connection.query("DELETE FROM roles WHERE id <> ?", [superAdminRoleId]);

    await connection.query(
      `UPDATE users
      SET status = 'active', failed_login_attempts = 0, last_login_at = NULL
      WHERE id = ?`,
      [superAdminUserId],
    );

    await connection.query(
      "UPDATE app_settings SET setting_value = ? WHERE setting_key = 'security_settings'",
      [JSON.stringify(defaultSecuritySettings)],
    );
    await connection.query(
      "UPDATE app_settings SET setting_value = ? WHERE setting_key = 'notification_settings'",
      [JSON.stringify(defaultNotificationSettings)],
    );
    await connection.query(
      "UPDATE app_settings SET setting_value = ? WHERE setting_key = 'privacy_settings'",
      [JSON.stringify(defaultPrivacySettings)],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function seedDueFollowUpCall(database: IntegrationDatabase) {
  assertSafeTestDatabaseName();
  await database.query(
    `INSERT INTO call_records
      (id, record_number, phone_number, student_name, interaction_type, category,
       issue, priority, status, needs_follow_up, follow_up_at, opened_by_user_id,
       assigned_to_user_id, created_at)
    VALUES (?, ?, '05550000000', 'Integration Student', 'phone', 'integration',
      'Integration follow-up', 'normal', 'open', 1, DATE_SUB(NOW(), INTERVAL 1 MINUTE),
      ?, ?, NOW())`,
    [dueFollowUpCall.id, dueFollowUpCall.recordNumber, superAdminUserId, superAdminUserId],
  );
}

export async function readFailedLoginAttempts(database: IntegrationDatabase) {
  const [rows] = await database.query<
    Array<RowDataPacket & { failedLoginAttempts: number }>
  >(
    `SELECT failed_login_attempts AS failedLoginAttempts
    FROM users
    WHERE id = ?`,
    [superAdminUserId],
  );

  return Number(rows[0]?.failedLoginAttempts ?? -1);
}
