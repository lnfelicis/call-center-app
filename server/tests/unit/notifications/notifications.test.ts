import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/modules/auth/types.js";
import { NotificationController } from "../../../src/modules/notifications/controller.js";
import { serializeNotification } from "../../../src/modules/notifications/mapper.js";
import type { NotificationRepository } from "../../../src/modules/notifications/repository.js";
import { NotificationService } from "../../../src/modules/notifications/service.js";
import type { NotificationRow } from "../../../src/modules/notifications/types.js";
import { defaultNotificationSettings } from "../../../src/modules/settings/app-settings.types.js";

function createService(overrides: Partial<Record<keyof NotificationRepository, unknown>> = {}) {
  const repository = {
    getUsersWithAnyPermission: vi.fn().mockResolvedValue([]),
    insertNotification: vi.fn().mockResolvedValue(undefined),
    findDueFollowUps: vi.fn().mockResolvedValue([]),
    findStaleCalls: vi.fn().mockResolvedValue([]),
    listPanelNotifications: vi.fn().mockResolvedValue([]),
    markRead: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as NotificationRepository;
  const settings = { ...defaultNotificationSettings };
  const readNotificationSettings = vi.fn().mockResolvedValue(settings);
  let generatedId = 0;
  const generateId = vi.fn(() => `id-${++generatedId}`);
  const service = new NotificationService({
    repository,
    readNotificationSettings,
    generateId,
  });

  return { repository, service, settings, readNotificationSettings, generateId };
}

describe("notification service", () => {
  it("deduplicates recipients and preserves panel/email loop order", async () => {
    const { repository, service, settings } = createService();
    settings.emailEnabled = true;

    await service.createNotifications({
      userIds: ["user-1", "user-1"],
      title: "Başlık",
      message: "Mesaj",
      type: "test",
      dedupeKey: "dedupe",
    });

    expect(repository.insertNotification).toHaveBeenNthCalledWith(1, {
      id: "id-1",
      userId: "user-1",
      title: "Başlık",
      message: "Mesaj",
      type: "test",
      channel: "panel",
      entityType: null,
      entityId: null,
      dedupeKey: "dedupe:user-1:panel",
    });
    expect(repository.insertNotification).toHaveBeenNthCalledWith(2, {
      id: "id-2",
      userId: "user-1",
      title: "Başlık",
      message: "Mesaj",
      type: "test",
      channel: "email",
      entityType: null,
      entityId: null,
      dedupeKey: "dedupe:user-1:email",
    });
  });

  it("does not read settings when there are no recipients", async () => {
    const readNotificationSettings = vi.fn();
    const repository = { insertNotification: vi.fn() } as unknown as NotificationRepository;
    const service = new NotificationService({
      repository,
      readNotificationSettings,
      generateId: vi.fn(),
    });

    await service.createNotifications({ userIds: [], title: "x", message: "y", type: "z" });

    expect(readNotificationSettings).not.toHaveBeenCalled();
    expect(repository.insertNotification).not.toHaveBeenCalled();
  });

  it("does not insert when both delivery channels are disabled", async () => {
    const { repository, service, settings, readNotificationSettings, generateId } =
      createService();
    settings.panelEnabled = false;
    settings.emailEnabled = false;

    await service.createNotifications({
      userIds: ["user-1"],
      title: "Başlık",
      message: "Mesaj",
      type: "test",
    });

    expect(readNotificationSettings).toHaveBeenCalledOnce();
    expect(generateId).not.toHaveBeenCalled();
    expect(repository.insertNotification).not.toHaveBeenCalled();
  });

  it("filters blank recipients and keeps null dedupe/entity defaults", async () => {
    const { repository, service } = createService();

    await service.createNotifications({
      userIds: ["", "user-1", "user-1"],
      title: "Başlık",
      message: "Mesaj",
      type: "test",
    });

    expect(repository.insertNotification).toHaveBeenCalledOnce();
    expect(repository.insertNotification).toHaveBeenCalledWith({
      id: "id-1",
      userId: "user-1",
      title: "Başlık",
      message: "Mesaj",
      type: "test",
      channel: "panel",
      entityType: null,
      entityId: null,
      dedupeKey: null,
    });
  });

  it("propagates insert failures without attempting later channels", async () => {
    const failure = new Error("insert failed");
    const { repository, service, settings } = createService({
      insertNotification: vi.fn().mockRejectedValue(failure),
    });
    settings.emailEnabled = true;

    await expect(
      service.createNotifications({
        userIds: ["user-1"],
        title: "Başlık",
        message: "Mesaj",
        type: "test",
      }),
    ).rejects.toBe(failure);
    expect(repository.insertNotification).toHaveBeenCalledOnce();
  });

  it("proxies permission lookup and creates notifications for resolved recipients", async () => {
    const { repository, service } = createService({
      getUsersWithAnyPermission: vi.fn().mockResolvedValue(["user-1", "user-2"]),
    });

    await expect(
      service.getUsersWithAnyPermission(["calls.resolve"]),
    ).resolves.toStrictEqual(["user-1", "user-2"]);
    await service.notifyUsersWithAnyPermission(["calls.view.all"], {
      title: "Başlık",
      message: "Mesaj",
      type: "call.stale",
      entityType: "call",
      entityId: "call-id",
      dedupeKey: "stale-call",
    });

    expect(repository.getUsersWithAnyPermission).toHaveBeenNthCalledWith(1, [
      "calls.resolve",
    ]);
    expect(repository.getUsersWithAnyPermission).toHaveBeenNthCalledWith(2, [
      "calls.view.all",
    ]);
    expect(repository.insertNotification).toHaveBeenCalledTimes(2);
    expect(repository.insertNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: "id-2",
        userId: "user-2",
        entityType: "call",
        entityId: "call-id",
        dedupeKey: "stale-call:user-2:panel",
      }),
    );
  });

  it("emits exact follow-up and stale operational inputs in row order", async () => {
    const { repository, service } = createService({
      findDueFollowUps: vi.fn().mockResolvedValue([
        {
          id: "follow-up-1",
          record_number: "C-1",
          opened_by_user_id: "user-1",
          assigned_to_user_id: null,
        },
        {
          id: "follow-up-2",
          record_number: "C-2",
          opened_by_user_id: "user-2",
          assigned_to_user_id: "user-3",
        },
      ]),
      findStaleCalls: vi.fn().mockResolvedValue([
        { id: "stale-1", record_number: "C-3" },
      ]),
    });
    const createNotifications = vi
      .spyOn(service, "createNotifications")
      .mockResolvedValue(undefined);
    const notifyUsers = vi
      .spyOn(service, "notifyUsersWithAnyPermission")
      .mockResolvedValue(undefined);

    await service.generateOperationalNotifications();

    expect(createNotifications).toHaveBeenNthCalledWith(1, {
      userIds: ["user-1"],
      title: "Takip tarihi gelen çağrı",
      message: "C-1 numaralı çağrı için takip zamanı geldi.",
      type: "call.follow_up_due",
      entityType: "call",
      entityId: "follow-up-1",
      dedupeKey: "follow-up-due:follow-up-1",
    });
    expect(createNotifications).toHaveBeenNthCalledWith(2, {
      userIds: ["user-2", "user-3"],
      title: "Takip tarihi gelen çağrı",
      message: "C-2 numaralı çağrı için takip zamanı geldi.",
      type: "call.follow_up_due",
      entityType: "call",
      entityId: "follow-up-2",
      dedupeKey: "follow-up-due:follow-up-2",
    });
    expect(notifyUsers).toHaveBeenCalledWith(
      ["calls.view.all", "calls.resolve"],
      {
        title: "Çözüm bekleyen çağrı",
        message: "C-3 numaralı çağrı belirlenen sürede çözülmedi.",
        type: "call.stale",
        entityType: "call",
        entityId: "stale-1",
        dedupeKey: "stale-call:stale-1:24",
      },
    );
  });

  it("skips both operational queries when their settings are disabled", async () => {
    const { repository, service, settings } = createService();
    settings.followUpReminderEnabled = false;
    settings.staleCallNotificationEnabled = false;

    await service.generateOperationalNotifications();

    expect(repository.findDueFollowUps).not.toHaveBeenCalled();
    expect(repository.findStaleCalls).not.toHaveBeenCalled();
  });

  it("keeps operational generation before panel listing", async () => {
    const { repository, service } = createService();

    await service.listPanelNotifications("user-1");

    expect(repository.findDueFollowUps).toHaveBeenCalledOnce();
    expect(repository.findStaleCalls).toHaveBeenCalledWith(24);
    expect(vi.mocked(repository.findStaleCalls).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.listPanelNotifications).mock.invocationCallOrder[0]!,
    );
  });

  it("proxies mark-read arguments and affected rows", async () => {
    const { repository, service } = createService({
      markRead: vi.fn().mockResolvedValue(2),
    });

    await expect(service.markRead("notification-id", undefined)).resolves.toBe(2);
    expect(repository.markRead).toHaveBeenCalledWith("notification-id", undefined);
  });
});

describe("notification mapper and controller", () => {
  it("keeps response key order and strict boolean conversion", () => {
    const serialized = serializeNotification({
      id: "id",
      title: "title",
      message: "message",
      notification_type: "test",
      channel: "panel",
      entity_type: null,
      entity_id: null,
      is_read: 1,
      read_at: null,
      created_at: "2026-01-01",
    } as NotificationRow);

    expect(Object.keys(serialized)).toStrictEqual([
      "id",
      "title",
      "message",
      "type",
      "channel",
      "entityType",
      "entityId",
      "isRead",
      "readAt",
      "createdAt",
    ]);
    expect(serialized.isRead).toBe(true);
    expect(
      serializeNotification({
        id: "id-2",
        title: "title",
        message: "message",
        notification_type: "test",
        channel: "panel",
        entity_type: "call",
        entity_id: "call-id",
        is_read: 0,
        read_at: "2026-01-02",
        created_at: "2026-01-01",
      } as NotificationRow).isRead,
    ).toBe(false);
  });

  it("lists serialized rows for the authenticated user", async () => {
    const row = {
      id: "id",
      title: "title",
      message: "message",
      notification_type: "test",
      channel: "panel",
      entity_type: null,
      entity_id: null,
      is_read: 0,
      read_at: null,
      created_at: "2026-01-01",
    } as NotificationRow;
    const { service } = createService({
      listPanelNotifications: vi.fn().mockResolvedValue([row]),
    });
    const listPanelNotifications = vi.spyOn(service, "listPanelNotifications");
    const controller = new NotificationController(service, vi.fn());
    const json = vi.fn();

    await controller.list(
      { user: { id: "user-1" } } as unknown as AuthenticatedRequest,
      { json } as unknown as Response,
    );

    expect(listPanelNotifications).toHaveBeenCalledWith("user-1");
    expect(json).toHaveBeenCalledWith({
      notifications: [
        {
          id: "id",
          title: "title",
          message: "message",
          type: "test",
          channel: "panel",
          entityType: null,
          entityId: null,
          isRead: false,
          readAt: null,
          createdAt: "2026-01-01",
        },
      ],
    });
  });

  it("does not audit a missing notification", async () => {
    const { service } = createService({ markRead: vi.fn().mockResolvedValue(0) });
    const audit = vi.fn();
    const controller = new NotificationController(service, audit);
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await controller.markRead(
      { params: { id: "missing" }, user: { id: "user-1" } } as unknown as AuthenticatedRequest,
      { status, json } as unknown as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Bildirim bulunamadı." });
    expect(audit).not.toHaveBeenCalled();
  });

  it("audits a successful mark-read before returning the exact body", async () => {
    const { service } = createService();
    const audit = vi.fn().mockResolvedValue(undefined);
    const controller = new NotificationController(service, audit);
    const markRead = vi.spyOn(service, "markRead");
    const json = vi.fn();
    const req = {
      params: { id: "notification-id" },
      user: { id: "user-1" },
    } as unknown as AuthenticatedRequest;

    await controller.markRead(req, { json } as unknown as Response);

    expect(markRead).toHaveBeenCalledWith("notification-id", "user-1");
    expect(audit).toHaveBeenCalledWith({
      req,
      action: "notification.read",
      entityType: "notification",
      entityId: "notification-id",
    });
    expect(json).toHaveBeenCalledWith({ ok: true });
    expect(audit.mock.invocationCallOrder[0]).toBeLessThan(
      json.mock.invocationCallOrder[0]!,
    );
  });

  it("normalizes a missing notification id and stops when audit fails", async () => {
    const { service } = createService();
    const failure = new Error("audit failed");
    const audit = vi.fn().mockRejectedValue(failure);
    const controller = new NotificationController(service, audit);
    const markRead = vi.spyOn(service, "markRead");
    const json = vi.fn();

    await expect(
      controller.markRead(
        { params: {}, user: undefined } as unknown as AuthenticatedRequest,
        { json } as unknown as Response,
      ),
    ).rejects.toBe(failure);

    expect(markRead).toHaveBeenCalledWith("", undefined);
    expect(json).not.toHaveBeenCalled();
  });
});
