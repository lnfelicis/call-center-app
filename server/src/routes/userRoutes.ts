import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireAnyPermission, requireAuth, requirePermission } from "../auth.js";
import { writeAuditLog } from "../audit.js";
import { db } from "../db.js";
import { getPasswordValidationErrors, hashPassword } from "../security.js";

type UserRow = RowDataPacket & {
  id: string;
  username: string;
  full_name: string;
  email: string;
  status: "active" | "passive";
  role_id: string;
  role_name: string;
  created_at: string;
  last_login_at: string | null;
};

export const userRoutes = Router();

userRoutes.use(requireAuth);

userRoutes.get(
  "/users/options",
  requireAnyPermission(["reports.view", "reports.export", "users.manage"]),
  async (_req, res) => {
    const [rows] = await db.query<UserRow[]>(
      `SELECT
        users.id,
        users.username,
        users.full_name,
        users.email,
        users.status,
        users.role_id,
        roles.name AS role_name,
        users.created_at,
        users.last_login_at
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      WHERE users.status = 'active'
      ORDER BY users.full_name ASC`,
    );

    res.json({
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        email: row.email,
        status: row.status,
        roleId: row.role_id,
        roleName: row.role_name,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      })),
    });
  },
);

userRoutes.get("/users", requirePermission("users.manage"), async (_req, res) => {
  const [rows] = await db.query<UserRow[]>(
    `SELECT
      users.id,
      users.username,
      users.full_name,
      users.email,
      users.status,
      users.role_id,
      roles.name AS role_name,
      users.created_at,
      users.last_login_at
    FROM users
    INNER JOIN roles ON roles.id = users.role_id
    ORDER BY users.created_at ASC`,
  );

  res.json({
    users: rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      status: row.status,
      roleId: row.role_id,
      roleName: row.role_name,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    })),
  });
});

userRoutes.post("/users", requirePermission("users.manage"), async (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const fullName = String(req.body.fullName ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  const password = String(req.body.password ?? "");
  const roleId = String(req.body.roleId ?? "");

  if (!username || !fullName || !email || !password || !roleId) {
    res.status(400).json({ message: "Kullanıcı adı, ad soyad, e-posta, şifre ve rol zorunludur." });
    return;
  }

  const passwordErrors = getPasswordValidationErrors(password);

  if (passwordErrors.length > 0) {
    res.status(400).json({ message: passwordErrors.join(" ") });
    return;
  }

  const userId = randomUUID();

  await db.query(
    `INSERT INTO users
      (id, username, full_name, email, password_hash, role_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [userId, username, fullName, email, await hashPassword(password), roleId],
  );

  await writeAuditLog({
    req,
    action: "user.create",
    entityType: "user",
    entityId: userId,
    metadata: { username, email, roleId },
  });

  res.status(201).json({ id: userId });
});

userRoutes.patch("/users/:id", requirePermission("users.manage"), async (req, res) => {
  const userId = String(req.params.id ?? "");
  const fullName = String(req.body.fullName ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  const roleId = String(req.body.roleId ?? "");
  const status = req.body.status === "passive" ? "passive" : "active";

  if (!fullName || !email || !roleId) {
    res.status(400).json({ message: "Ad soyad, e-posta ve rol zorunludur." });
    return;
  }

  const [result] = await db.query<ResultSetHeader>(
    `UPDATE users
    SET full_name = ?, email = ?, role_id = ?, status = ?
    WHERE id = ?`,
    [fullName, email, roleId, status, userId],
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return;
  }

  await writeAuditLog({
    req,
    action: "user.update",
    entityType: "user",
    entityId: userId,
    metadata: { email, roleId, status },
  });

  res.json({ ok: true });
});
