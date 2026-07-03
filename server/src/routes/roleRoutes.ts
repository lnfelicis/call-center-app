import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireAnyPermission, requireAuth, requirePermission } from "../auth.js";
import { writeAuditLog } from "../audit.js";
import { db } from "../db.js";

type PermissionRow = RowDataPacket & {
  id: string;
  group_name: string;
  label: string;
  description: string | null;
};

type RoleRow = RowDataPacket & {
  id: string;
  name: string;
  description: string | null;
  is_system: 0 | 1;
  is_active: 0 | 1;
  created_at: string;
  permission_id: string | null;
};

function normalizePermissionIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).filter(Boolean);
}

async function assertPermissionIdsExist(permissionIds: string[]) {
  if (permissionIds.length === 0) {
    return;
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM permissions WHERE id IN (${permissionIds.map(() => "?").join(",")})`,
    permissionIds,
  );

  if (rows.length !== permissionIds.length) {
    throw new Error("Geçersiz izin seçimi var.");
  }
}

export const roleRoutes = Router();

roleRoutes.use(requireAuth);

roleRoutes.get("/permissions", requirePermission("roles.manage"), async (_req, res) => {
  const [rows] = await db.query<PermissionRow[]>(
    `SELECT id, group_name, label, description
    FROM permissions
    ORDER BY group_name, label`,
  );

  res.json({
    permissions: rows.map((row) => ({
      id: row.id,
      groupName: row.group_name,
      label: row.label,
      description: row.description,
    })),
  });
});

roleRoutes.get("/roles", requireAnyPermission(["roles.manage", "users.manage"]), async (_req, res) => {
  const [rows] = await db.query<RoleRow[]>(
    `SELECT
      roles.id,
      roles.name,
      roles.description,
      roles.is_system,
      roles.is_active,
      roles.created_at,
      role_permissions.permission_id
    FROM roles
    LEFT JOIN role_permissions ON role_permissions.role_id = roles.id
    ORDER BY roles.created_at ASC, roles.name ASC`,
  );

  const roles = new Map<string, {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    createdAt: string;
    permissions: string[];
  }>();

  for (const row of rows) {
    const existing =
      roles.get(row.id) ??
      {
        id: row.id,
        name: row.name,
        description: row.description,
        isSystem: row.is_system === 1,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        permissions: [],
      };

    if (row.permission_id) {
      existing.permissions.push(row.permission_id);
    }

    roles.set(row.id, existing);
  }

  res.json({ roles: [...roles.values()] });
});

roleRoutes.post("/roles", requirePermission("roles.manage"), async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const description = String(req.body.description ?? "").trim() || null;
  const permissionIds = normalizePermissionIds(req.body.permissions);

  if (name.length < 2) {
    res.status(400).json({ message: "Rol adı en az 2 karakter olmalıdır." });
    return;
  }

  if (permissionIds.length === 0) {
    res.status(400).json({ message: "Rol oluşturmak için en az bir izin seçilmelidir." });
    return;
  }

  await assertPermissionIdsExist(permissionIds);

  const roleId = randomUUID();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO roles (id, name, description, is_system, is_active) VALUES (?, ?, ?, 0, 1)",
      [roleId, name, description],
    );

    for (const permissionId of permissionIds) {
      await connection.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
        [roleId, permissionId],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await writeAuditLog({
    req,
    action: "role.create",
    entityType: "role",
    entityId: roleId,
    metadata: { name, permissions: permissionIds },
  });

  res.status(201).json({ id: roleId });
});

roleRoutes.patch("/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  const roleId = String(req.params.id ?? "");
  const name = String(req.body.name ?? "").trim();
  const description = String(req.body.description ?? "").trim() || null;
  const isActive = Boolean(req.body.isActive);

  if (name.length < 2) {
    res.status(400).json({ message: "Rol adı en az 2 karakter olmalıdır." });
    return;
  }

  const [result] = await db.query<ResultSetHeader>(
    "UPDATE roles SET name = ?, description = ?, is_active = ? WHERE id = ?",
    [name, description, isActive ? 1 : 0, roleId],
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ message: "Rol bulunamadı." });
    return;
  }

  await writeAuditLog({
    req,
    action: "role.update",
    entityType: "role",
    entityId: roleId,
    metadata: { name, isActive },
  });

  res.json({ ok: true });
});

roleRoutes.patch(
  "/roles/:id/permissions",
  requirePermission("roles.manage"),
  async (req, res) => {
    const roleId = String(req.params.id ?? "");
    const permissionIds = normalizePermissionIds(req.body.permissions);

    if (permissionIds.length === 0) {
      res.status(400).json({ message: "Rol üzerinde en az bir izin kalmalıdır." });
      return;
    }

    await assertPermissionIdsExist(permissionIds);

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);

      for (const permissionId of permissionIds) {
        await connection.query(
          "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          [roleId, permissionId],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAuditLog({
      req,
      action: "role.permissions.update",
      entityType: "role",
      entityId: roleId,
      metadata: { permissions: permissionIds },
    });

    res.json({ ok: true });
  },
);
