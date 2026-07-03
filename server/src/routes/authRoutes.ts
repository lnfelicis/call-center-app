import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { db } from "../db.js";
import { getUserWithPermissions, requireAuth, type AuthenticatedRequest } from "../auth.js";
import { signToken, verifyPassword } from "../security.js";
import { writeAuditLog } from "../audit.js";

type LoginUserRow = RowDataPacket & {
  id: string;
  password_hash: string;
  status: "active" | "passive";
};

export const authRoutes = Router();

authRoutes.post("/login", async (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!username || !password) {
    res.status(400).json({ message: "Kullanıcı adı ve şifre zorunludur." });
    return;
  }

  const [rows] = await db.query<LoginUserRow[]>(
    "SELECT id, password_hash, status FROM users WHERE username = ? OR email = ? LIMIT 1",
    [username, username],
  );
  const user = rows[0];

  if (!user || user.status !== "active") {
    res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı." });
    return;
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);

  if (!passwordMatches) {
    await db.query("UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?", [
      user.id,
    ]);
    res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı." });
    return;
  }

  await db.query(
    "UPDATE users SET failed_login_attempts = 0, last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
    [user.id],
  );

  const authUser = await getUserWithPermissions(user.id);

  if (!authUser) {
    res.status(401).json({ message: "Kullanıcı rolü aktif değil." });
    return;
  }

  await writeAuditLog({
    req,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });

  res.json({
    token: signToken(user.id),
    user: authUser,
  });
});

authRoutes.post("/logout", requireAuth, async (req, res) => {
  await writeAuditLog({
    req,
    action: "auth.logout",
    entityType: "user",
    entityId: (req as AuthenticatedRequest).user?.id,
  });

  res.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});
