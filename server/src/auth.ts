import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2";
import { db } from "./db.js";
import { verifyToken } from "./security.js";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

type UserPermissionRow = RowDataPacket & {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  permission_id: string | null;
};

export async function getUserWithPermissions(userId: string) {
  const [rows] = await db.query<UserPermissionRow[]>(
    `SELECT
      users.id,
      users.username,
      users.full_name,
      users.email,
      users.role_id,
      roles.name AS role_name,
      role_permissions.permission_id
    FROM users
    INNER JOIN roles ON roles.id = users.role_id
    LEFT JOIN role_permissions ON role_permissions.role_id = roles.id
    WHERE users.id = ? AND users.status = 'active' AND roles.is_active = 1`,
    [userId],
  );

  if (rows.length === 0) {
    return null;
  }

  const first = rows[0];

  return {
    id: first.id,
    username: first.username,
    fullName: first.full_name,
    email: first.email,
    roleId: first.role_id,
    roleName: first.role_name,
    permissions: rows.flatMap((row) => (row.permission_id ? [row.permission_id] : [])),
  } satisfies AuthUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ message: "Oturum gerekli." });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ message: "Oturum geçersiz veya süresi dolmuş." });
    return;
  }

  const user = await getUserWithPermissions(payload.sub);

  if (!user) {
    res.status(401).json({ message: "Kullanıcı aktif değil veya bulunamadı." });
    return;
  }

  req.user = user;
  next();
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(permission)) {
      res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
      return;
    }

    next();
  };
}

export function requireAnyPermission(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userPermissions = req.user?.permissions ?? [];

    if (!permissions.some((permission) => userPermissions.includes(permission))) {
      res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
      return;
    }

    next();
  };
}
