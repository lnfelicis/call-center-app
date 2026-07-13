import { afterEach, describe, expect, it, vi } from "vitest";
import { getUserWithPermissions } from "../../../src/auth.js";
import { db } from "../../../src/db.js";
import {
  createNotifications,
  generateOperationalNotifications,
  getUsersWithAnyPermission,
  notificationService,
  notifyUsersWithAnyPermission,
} from "../../../src/notifications.js";
import {
  appSettingsService,
  readAppSetting,
  writeAppSetting,
} from "../../../src/settings.js";

describe("legacy compatibility wrappers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates auth user lookup to the default repository", async () => {
    vi.spyOn(db, "query").mockResolvedValueOnce([[
      {
        id: "user-1",
        username: "omer",
        full_name: "Ömer Test",
        email: "omer@example.test",
        role_id: "role-1",
        role_name: "Yönetici",
        permission_id: "users.manage",
      },
    ], []] as never);

    await expect(getUserWithPermissions("user-1")).resolves.toStrictEqual({
      id: "user-1",
      username: "omer",
      fullName: "Ömer Test",
      email: "omer@example.test",
      roleId: "role-1",
      roleName: "Yönetici",
      permissions: ["users.manage"],
    });
  });

  it("delegates settings reads and writes without changing arguments or results", async () => {
    const securitySettings = {
      sessionDurationMinutes: 30,
      failedLoginLimit: 3,
      ipAllowlist: ["10.0.0.8"],
    };
    const read = vi.spyOn(appSettingsService, "read").mockResolvedValue(securitySettings);
    const write = vi.spyOn(appSettingsService, "write").mockResolvedValue(securitySettings);

    await expect(readAppSetting("security_settings")).resolves.toBe(securitySettings);
    await expect(writeAppSetting("security_settings", { failedLoginLimit: 3 })).resolves.toBe(
      securitySettings,
    );

    expect(read).toHaveBeenCalledWith("security_settings");
    expect(write).toHaveBeenCalledWith("security_settings", { failedLoginLimit: 3 });
  });

  it("delegates all notification compatibility functions", async () => {
    const input = {
      userIds: ["user-1"],
      title: "Başlık",
      message: "Mesaj",
      type: "test",
    };
    const notification = {
      title: "Başlık",
      message: "Mesaj",
      type: "test",
    };
    const getUsers = vi
      .spyOn(notificationService, "getUsersWithAnyPermission")
      .mockResolvedValue(["user-1"]);
    const create = vi
      .spyOn(notificationService, "createNotifications")
      .mockResolvedValue(undefined);
    const notify = vi
      .spyOn(notificationService, "notifyUsersWithAnyPermission")
      .mockResolvedValue(undefined);
    const generate = vi
      .spyOn(notificationService, "generateOperationalNotifications")
      .mockResolvedValue(undefined);

    await expect(getUsersWithAnyPermission(["calls.view.all"])).resolves.toStrictEqual(["user-1"]);
    await createNotifications(input);
    await notifyUsersWithAnyPermission(["calls.resolve"], notification);
    await generateOperationalNotifications();

    expect(getUsers).toHaveBeenCalledWith(["calls.view.all"]);
    expect(create).toHaveBeenCalledWith(input);
    expect(notify).toHaveBeenCalledWith(["calls.resolve"], notification);
    expect(generate).toHaveBeenCalledOnce();
  });
});
