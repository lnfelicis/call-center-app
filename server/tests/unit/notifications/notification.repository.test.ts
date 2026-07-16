import type { ResultSetHeader } from "mysql2";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../src/database/database.js";
import { NotificationRepository } from "../../../src/modules/notifications/repository.js";
import type {
  FollowUpCallRow,
  NotificationRow,
  RecipientRow,
  StaleCallRow,
} from "../../../src/modules/notifications/types.js";

function compactSql(value: unknown) {
  return String(value).replace(/\s+/g, " ").trim();
}

function createRepository(...queryResults: unknown[]) {
  const query = vi.fn();
  for (const result of queryResults) {
    query.mockResolvedValueOnce(result);
  }
  return { query, repository: new NotificationRepository({ query } as unknown as Database) };
}

describe("NotificationRepository", () => {
  it("returns no recipients without issuing invalid IN SQL for an empty permission list", async () => {
    const { query, repository } = createRepository();

    await expect(repository.getUsersWithAnyPermission([])).resolves.toStrictEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("builds one placeholder per permission and maps recipient ids", async () => {
    const rows = [{ id: "user-1" }, { id: "user-2" }] as RecipientRow[];
    const { query, repository } = createRepository([rows, []]);

    await expect(
      repository.getUsersWithAnyPermission(["calls.view.all", "calls.resolve"]),
    ).resolves.toStrictEqual(["user-1", "user-2"]);

    expect(compactSql(query.mock.calls[0]?.[0])).toBe(
      "SELECT DISTINCT users.id FROM users INNER JOIN roles ON roles.id = users.role_id INNER JOIN effective_user_permissions ON effective_user_permissions.user_id = users.id WHERE users.status = 'active' AND roles.is_active = 1 AND effective_user_permissions.permission_id IN (?, ?)",
    );
    expect(query.mock.calls[0]?.[1]).toStrictEqual([
      "calls.view.all",
      "calls.resolve",
    ]);
  });

  it("inserts all notification columns in the preserved parameter order", async () => {
    const { query, repository } = createRepository([{} as ResultSetHeader, []]);
    const input = {
      id: "notification-id",
      userId: "user-id",
      title: "Başlık",
      message: "Mesaj",
      type: "call.stale",
      channel: "email" as const,
      entityType: "call",
      entityId: "call-id",
      dedupeKey: "dedupe:user-id:email",
    };

    await repository.insertNotification(input);

    expect(compactSql(query.mock.calls[0]?.[0])).toBe(
      "INSERT IGNORE INTO notifications (id, user_id, title, message, notification_type, channel, entity_type, entity_id, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    expect(query.mock.calls[0]?.[1]).toStrictEqual([
      "notification-id",
      "user-id",
      "Başlık",
      "Mesaj",
      "call.stale",
      "email",
      "call",
      "call-id",
      "dedupe:user-id:email",
    ]);
  });

  it("reads due follow-ups and stale calls with stable filters", async () => {
    const followUpRows = [
      {
        id: "call-1",
        record_number: "C-1",
        opened_by_user_id: "user-1",
        assigned_to_user_id: null,
      } as FollowUpCallRow,
    ];
    const staleRows = [{ id: "call-2", record_number: "C-2" } as StaleCallRow];
    const { query, repository } = createRepository([followUpRows, []], [staleRows, []]);

    await expect(repository.findDueFollowUps()).resolves.toStrictEqual(followUpRows);
    await expect(repository.findStaleCalls(36)).resolves.toStrictEqual(staleRows);

    expect(compactSql(query.mock.calls[0]?.[0])).toContain(
      "WHERE needs_follow_up = 1 AND follow_up_at IS NOT NULL AND follow_up_at <= NOW()",
    );
    expect(compactSql(query.mock.calls[0]?.[0])).toContain(
      "ORDER BY follow_up_at ASC LIMIT 50",
    );
    expect(compactSql(query.mock.calls[1]?.[0])).toContain(
      "WHERE created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)",
    );
    expect(compactSql(query.mock.calls[1]?.[0])).toContain(
      "ORDER BY created_at ASC LIMIT 50",
    );
    expect(query.mock.calls[1]?.[1]).toStrictEqual([36]);
  });

  it("lists panel notifications and marks the requesting user's row read", async () => {
    const notificationRows = [
      {
        id: "notification-id",
        title: "Başlık",
        message: "Mesaj",
        notification_type: "test",
        channel: "panel",
        entity_type: null,
        entity_id: null,
        is_read: 0,
        read_at: null,
        created_at: "2026-01-01",
      } as NotificationRow,
    ];
    const { query, repository } = createRepository(
      [notificationRows, []],
      [{ affectedRows: 1 } as ResultSetHeader, []],
    );

    await expect(repository.listPanelNotifications("user-id")).resolves.toStrictEqual(
      notificationRows,
    );
    await expect(repository.markRead("notification-id", "user-id")).resolves.toBe(1);

    expect(compactSql(query.mock.calls[0]?.[0])).toBe(
      "SELECT id, title, message, notification_type, channel, entity_type, entity_id, is_read, read_at, created_at FROM notifications WHERE user_id = ? AND channel = 'panel' ORDER BY is_read ASC, created_at DESC LIMIT 100",
    );
    expect(query.mock.calls[0]?.[1]).toStrictEqual(["user-id"]);
    expect(compactSql(query.mock.calls[1]?.[0])).toBe(
      "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?",
    );
    expect(query.mock.calls[1]?.[1]).toStrictEqual(["notification-id", "user-id"]);
  });
});
