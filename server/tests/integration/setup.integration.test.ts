import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import mysql from "mysql2/promise";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { protectedApiEndpoints } from "../contracts/api-manifest.js";
import {
  dueFollowUpCall,
  readFailedLoginAttempts,
  resetIntegrationState,
  seedDueFollowUpCall,
  superAdminRoleId,
  superAdminUserId,
  writeJsonSetting,
} from "../helpers/integration-fixtures.js";
import {
  hasTestDatabaseConfig,
  recreateTestDatabase,
} from "../helpers/test-database.js";

const enabled = hasTestDatabaseConfig();

type SetupConfig = import("../../src/setup.js").SetupConfig;
type RunSetup = typeof import("../../src/setup.js").runSetup;

let app: Express;
let database: Pool;
let setupConfig: SetupConfig;
let runSetup: RunSetup;
let setupDependencies: Parameters<RunSetup>[1];
let expectedPermissionIds: string[];

async function login(identity = setupConfig.superAdmin.username) {
  return request(app).post("/auth/login").send({
    username: identity,
    password: setupConfig.superAdmin.password,
  });
}

async function authenticatedToken() {
  const response = await login();
  expect(response.status).toBe(200);
  return String(response.body.token);
}

function sendWithoutAuthentication(method: "get" | "post" | "patch" | "delete", path: string) {
  if (method === "get") {
    return request(app).get(path);
  }

  if (method === "post") {
    return request(app).post(path).send({});
  }

  return request(app).patch(path).send({});
}

async function readSeedCounts() {
  const [rows] = await database.query<
    Array<
      RowDataPacket & {
        permissions: number;
        rolePermissions: number;
        roles: number;
        users: number;
        settings: number;
        fields: number;
        options: number;
      }
    >
  >(
    `SELECT
      (SELECT COUNT(*) FROM permissions) AS permissions,
      (SELECT COUNT(*) FROM role_permissions WHERE role_id = ?) AS rolePermissions,
      (SELECT COUNT(*) FROM roles WHERE id = ?) AS roles,
      (SELECT COUNT(*) FROM users WHERE id = ?) AS users,
      (SELECT COUNT(*) FROM app_settings) AS settings,
      (SELECT COUNT(*) FROM call_form_fields) AS fields,
      (SELECT COUNT(*) FROM call_form_options) AS options`,
    [superAdminRoleId, superAdminRoleId, superAdminUserId],
  );

  const row = rows[0]!;
  return {
    permissions: Number(row.permissions),
    rolePermissions: Number(row.rolePermissions),
    roles: Number(row.roles),
    users: Number(row.users),
    settings: Number(row.settings),
    fields: Number(row.fields),
    options: Number(row.options),
  };
}

beforeAll(async () => {
  if (!enabled) {
    return;
  }

  await recreateTestDatabase();

  const [
    databaseModule,
    appModule,
    compositionModule,
    configModule,
    loggerModule,
    setupModule,
    securityModule,
    schemaModule,
  ] =
    await Promise.all([
      import("../../src/database/mysql.js"),
      import("../../src/app.js"),
      import("../../src/composition/app-routers.js"),
      import("../../src/config/app-config.js"),
      import("../../src/http/logger.js"),
      import("../../src/setup.js"),
      import("../../src/modules/auth/security.js"),
      import("../../src/database/schema.js"),
    ]);

  const appConfig = configModule.readAppConfig();
  database = databaseModule.createPool(appConfig.database);
  app = appModule.createApp({
    config: appConfig,
    logger: loggerModule.createLogger("silent"),
    routers: compositionModule.createAppRouters({ database }),
  });
  setupConfig = setupModule.readSetupConfig();
  runSetup = setupModule.runSetup;
  setupDependencies = {
    database,
    createServerConnection: mysql.createConnection,
    hashPassword: securityModule.hashPassword,
    generateId: randomUUID,
    output: { log: () => undefined },
  };
  expectedPermissionIds = schemaModule.permissions.map(({ id }) => id).sort();

  await runSetup(setupConfig, setupDependencies);
});

afterAll(async () => {
  if (enabled) {
    await database.end();
  }
});

describe.skipIf(!enabled)("API integration against a dedicated MySQL _test schema", () => {
  it("runs setup repeatedly without duplicating seeded application records", async () => {
    await resetIntegrationState(database);
    const before = await readSeedCounts();

    await runSetup(setupConfig, setupDependencies);
    await runSetup(setupConfig, setupDependencies);

    const after = await readSeedCounts();
    expect(after).toEqual(before);
    expect(after.permissions).toBeGreaterThan(0);
    expect(after.rolePermissions).toBe(after.permissions);
    expect(after.roles).toBe(1);
    expect(after.users).toBe(1);
    expect(after.settings).toBe(3);
  });

  it("keeps login public and rejects every other API endpoint without a token", async () => {
    await resetIntegrationState(database);

    const publicLogin = await request(app).post("/auth/login").send({});
    expect(publicLogin.status).toBe(400);
    expect(publicLogin.text).toBe(
      '{"message":"Kullanıcı adı ve şifre zorunludur."}',
    );
    expect(protectedApiEndpoints).toHaveLength(46);

    for (const endpoint of protectedApiEndpoints) {
      const response = await sendWithoutAuthentication(endpoint.method, endpoint.path);
      expect(
        { status: response.status, body: response.text },
        `${endpoint.method.toUpperCase()} ${endpoint.path}`,
      ).toEqual({
        status: 401,
        body: '{"message":"Oturum gerekli."}',
      });
    }
  });

  it("logs in by username and e-mail with the exact response shape and audit rows", async () => {
    await resetIntegrationState(database);

    const usernameResponse = await request(app)
      .post("/auth/login")
      .set("user-agent", "integration-auth-test")
      .send({
        username: setupConfig.superAdmin.username,
        password: setupConfig.superAdmin.password,
      });

    expect(usernameResponse.status).toBe(200);
    expect(Object.keys(usernameResponse.body)).toEqual(["token", "user"]);
    expect(String(usernameResponse.body.token)).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
    expect(Object.keys(usernameResponse.body.user)).toEqual([
      "id",
      "username",
      "fullName",
      "email",
      "roleId",
      "roleName",
      "permissions",
    ]);
    expect(usernameResponse.body.user).toEqual({
      id: superAdminUserId,
      username: setupConfig.superAdmin.username,
      fullName: setupConfig.superAdmin.fullName,
      email: setupConfig.superAdmin.email,
      roleId: superAdminRoleId,
      roleName: "Süper Admin",
      permissions: expectedPermissionIds,
    });

    const emailResponse = await login(setupConfig.superAdmin.email);
    expect(emailResponse.status).toBe(200);
    expect(Object.keys(emailResponse.body)).toEqual(["token", "user"]);
    expect(emailResponse.body.user).toEqual(usernameResponse.body.user);

    const [auditRows] = await database.query<
      Array<
        RowDataPacket & {
          actorUserId: string;
          action: string;
          entityType: string;
          entityId: string;
          metadata: string;
          userAgent: string | null;
        }
      >
    >(
      `SELECT actor_user_id AS actorUserId, action, entity_type AS entityType,
        entity_id AS entityId, CAST(metadata AS CHAR) AS metadata,
        user_agent AS userAgent
      FROM audit_logs
      WHERE action = 'auth.login'
      ORDER BY created_at ASC`,
    );

    expect(auditRows).toHaveLength(2);
    expect(auditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: null,
          action: "auth.login",
          entityType: "user",
          entityId: superAdminUserId,
          metadata: "{}",
          userAgent: "integration-auth-test",
        }),
        expect.objectContaining({
          actorUserId: null,
          action: "auth.login",
          entityType: "user",
          entityId: superAdminUserId,
          metadata: "{}",
          userAgent: null,
        }),
      ]),
    );
  });

  it("applies per-user allow and deny overrides to protected endpoints immediately", async () => {
    await resetIntegrationState(database);
    const adminToken = await authenticatedToken();
    const adminAuthorization = `Bearer ${adminToken}`;
    const password = "ValidPass1!";

    const managerRole = await request(app)
      .post("/roles")
      .set("authorization", adminAuthorization)
      .send({
        name: "Integration Manager",
        description: "Override integration role",
        permissions: ["logs.view"],
      });
    expect(managerRole.status).toBe(201);

    const limitedRole = await request(app)
      .post("/roles")
      .set("authorization", adminAuthorization)
      .send({
        name: "Integration Limited",
        description: "Allow override integration role",
        permissions: ["calls.view.own"],
      });
    expect(limitedRole.status).toBe(201);

    const users = [
      { username: "manager-a", fullName: "Manager A", roleId: managerRole.body.id },
      { username: "manager-b", fullName: "Manager B", roleId: managerRole.body.id },
      { username: "limited-c", fullName: "Limited C", roleId: limitedRole.body.id },
    ];

    const createdIds: string[] = [];
    for (const user of users) {
      const created = await request(app)
        .post("/users")
        .set("authorization", adminAuthorization)
        .send({
          ...user,
          email: `${user.username}@example.test`,
          password,
          permissionOverrides: [],
        });
      expect(created.status).toBe(201);
      createdIds.push(String(created.body.id));
    }

    const denyLogs = await request(app)
      .patch(`/users/${createdIds[1]}`)
      .set("authorization", adminAuthorization)
      .send({
        fullName: users[1]!.fullName,
        email: `${users[1]!.username}@example.test`,
        roleId: managerRole.body.id,
        status: "active",
        permissionOverrides: [{ permissionId: "logs.view", effect: "deny" }],
      });
    expect(denyLogs.status).toBe(200);

    const allowLogs = await request(app)
      .patch(`/users/${createdIds[2]}`)
      .set("authorization", adminAuthorization)
      .send({
        fullName: users[2]!.fullName,
        email: `${users[2]!.username}@example.test`,
        roleId: limitedRole.body.id,
        status: "active",
        permissionOverrides: [{ permissionId: "logs.view", effect: "allow" }],
      });
    expect(allowLogs.status).toBe(200);

    const statuses: Record<string, number> = {};
    for (const user of users) {
      const loginResponse = await request(app).post("/auth/login").send({
        username: user.username,
        password,
      });
      expect(loginResponse.status).toBe(200);
      const logsResponse = await request(app)
        .get("/logs")
        .set("authorization", `Bearer ${String(loginResponse.body.token)}`);
      statuses[user.username] = logsResponse.status;
    }

    expect(statuses).toStrictEqual({
      "manager-a": 200,
      "manager-b": 403,
      "limited-c": 200,
    });
  });

  it("increments wrong-password attempts and returns 423 after the configured limit", async () => {
    await resetIntegrationState(database);
    await writeJsonSetting(database, "security_settings", {
      sessionDurationMinutes: 480,
      failedLoginLimit: 2,
      ipAllowlist: [],
    });

    for (const expectedAttempts of [1, 2]) {
      const response = await request(app).post("/auth/login").send({
        username: setupConfig.superAdmin.username,
        password: "WrongPassword!1",
      });

      expect(response.status).toBe(401);
      expect(response.text).toBe(
        '{"message":"Kullanıcı adı veya şifre hatalı."}',
      );
      expect(await readFailedLoginAttempts(database)).toBe(expectedAttempts);
    }

    const blocked = await login();
    expect(blocked.status).toBe(423);
    expect(blocked.text).toBe(
      '{"message":"Hatalı giriş limiti aşıldı. Yönetici ile iletişime geçin."}',
    );
    expect(await readFailedLoginAttempts(database)).toBe(2);

    const [auditRows] = await database.query<
      Array<RowDataPacket & { action: string; metadata: string }>
    >(
      `SELECT action, CAST(metadata AS CHAR) AS metadata
      FROM audit_logs
      WHERE action = 'auth.login.blocked'`,
    );
    expect(auditRows).toEqual([
      expect.objectContaining({
        action: "auth.login.blocked",
        metadata: expect.stringContaining("failed_login_limit"),
      }),
    ]);
  });

  it("leaves no transaction open after an invalid settings update and accepts the next update", async () => {
    await resetIntegrationState(database);
    const token = await authenticatedToken();
    const authorization = `Bearer ${token}`;
    const baseline = await request(app)
      .get("/settings")
      .set("authorization", authorization);

    expect(baseline.status).toBe(200);
    expect(Object.keys(baseline.body)).toEqual(["options", "fields"]);
    const field = baseline.body.fields[0] as Record<string, unknown>;
    expect(field).toBeDefined();

    const invalid = await request(app)
      .patch("/settings")
      .set("authorization", authorization)
      .send({
        fields: [{ ...field, label: `${String(field.label)} transient` }],
        options: [{ id: "", type: "status", label: "x" }],
      });

    expect(invalid.status).toBe(400);
    expect(invalid.text).toBe(
      '{"message":"Seçenek ayarlarında geçersiz kayıt var."}',
    );

    const unchanged = await request(app)
      .get("/settings")
      .set("authorization", authorization);
    expect(unchanged.status).toBe(200);
    expect(unchanged.text).toBe(baseline.text);

    const valid = await request(app)
      .patch("/settings")
      .set("authorization", authorization)
      .send({ fields: [field], options: [] });

    expect(valid.status).toBe(200);
    expect(valid.text).toBe(baseline.text);

    const [auditRows] = await database.query<
      Array<RowDataPacket & { actorUserId: string; action: string; metadata: string }>
    >(
      `SELECT actor_user_id AS actorUserId, action, CAST(metadata AS CHAR) AS metadata
      FROM audit_logs
      WHERE action = 'settings.update'`,
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      actorUserId: superAdminUserId,
      action: "settings.update",
    });
    expect(JSON.parse(auditRows[0]!.metadata)).toEqual({
      fieldCount: 1,
      optionCount: 0,
    });
  });

  it("creates operational notifications on GET once, then marks one read and audits it", async () => {
    await resetIntegrationState(database);
    await writeJsonSetting(database, "notification_settings", {
      panelEnabled: true,
      emailEnabled: false,
      followUpReminderEnabled: true,
      urgentNotificationEnabled: true,
      staleCallNotificationEnabled: false,
      staleCallHours: 24,
    });
    await seedDueFollowUpCall(database);
    const token = await authenticatedToken();
    const authorization = `Bearer ${token}`;

    const first = await request(app)
      .get("/notifications")
      .set("authorization", authorization);

    expect(first.status).toBe(200);
    expect(Object.keys(first.body)).toEqual(["notifications"]);
    expect(first.body.notifications).toHaveLength(1);
    const notification = first.body.notifications[0] as Record<string, unknown>;
    expect(Object.keys(notification)).toEqual([
      "id",
      "title",
      "message",
      "type",
      "channel",
      "entityType",
      "entityId",
      "entityLabel",
      "isRead",
      "readAt",
      "createdAt",
    ]);
    expect(notification).toMatchObject({
      title: "Takip tarihi gelen çağrı",
      message: `${dueFollowUpCall.recordNumber} numaralı çağrı için takip zamanı geldi.`,
      type: "call.follow_up_due",
      channel: "panel",
      entityType: "call",
      entityId: dueFollowUpCall.id,
      entityLabel: dueFollowUpCall.recordNumber,
      isRead: false,
      readAt: null,
    });
    expect(notification.id).toEqual(expect.any(String));
    expect(notification.createdAt).toEqual(expect.any(String));

    const second = await request(app)
      .get("/notifications")
      .set("authorization", authorization);
    expect(second.status).toBe(200);
    expect(second.text).toBe(first.text);

    const [notificationRows] = await database.query<
      Array<RowDataPacket & { count: number; dedupeKey: string }>
    >(
      `SELECT COUNT(*) AS count, MAX(dedupe_key) AS dedupeKey
      FROM notifications`,
    );
    expect(Number(notificationRows[0]?.count)).toBe(1);
    expect(notificationRows[0]?.dedupeKey).toBe(
      `follow-up-due:${dueFollowUpCall.id}:${superAdminUserId}:panel`,
    );

    const markRead = await request(app)
      .patch(`/notifications/${String(notification.id)}/read`)
      .set("authorization", authorization)
      .send({});
    expect(markRead.status).toBe(200);
    expect(markRead.text).toBe('{"ok":true}');

    const [readRows] = await database.query<
      Array<RowDataPacket & { isRead: number; readAt: Date | null }>
    >(
      `SELECT is_read AS isRead, read_at AS readAt
      FROM notifications
      WHERE id = ?`,
      [notification.id],
    );
    expect(Number(readRows[0]?.isRead)).toBe(1);
    expect(readRows[0]?.readAt).toBeInstanceOf(Date);

    const [auditRows] = await database.query<
      Array<
        RowDataPacket & {
          actorUserId: string;
          action: string;
          entityType: string;
          entityId: string;
        }
      >
    >(
      `SELECT actor_user_id AS actorUserId, action, entity_type AS entityType,
        entity_id AS entityId
      FROM audit_logs
      WHERE action = 'notification.read'`,
    );
    expect(auditRows).toEqual([
      expect.objectContaining({
        actorUserId: superAdminUserId,
        action: "notification.read",
        entityType: "notification",
        entityId: notification.id,
      }),
    ]);
  });
});
