import type { Request, Response } from "express";
import { coerceRoleIsActive, normalizePermissionIds } from "./policy.js";
import type { RoleService } from "./service.js";

export class RoleController {
  constructor(private readonly service: RoleService) {}

  permissions = async (_req: Request, res: Response) => {
    res.json({ permissions: await this.service.listPermissions() });
  };

  list = async (_req: Request, res: Response) => {
    res.json({ roles: await this.service.listRoles() });
  };

  create = async (req: Request, res: Response) => {
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

    const roleId = await this.service.create(req, { name, description, permissionIds });
    res.status(201).json({ id: roleId });
  };

  update = async (req: Request, res: Response) => {
    const roleId = String(req.params.id ?? "");
    const name = String(req.body.name ?? "").trim();
    const description = String(req.body.description ?? "").trim() || null;
    const isActive = coerceRoleIsActive(req.body.isActive);

    if (name.length < 2) {
      res.status(400).json({ message: "Rol adı en az 2 karakter olmalıdır." });
      return;
    }

    const updated = await this.service.update(req, { roleId, name, description, isActive });

    if (!updated) {
      res.status(404).json({ message: "Rol bulunamadı." });
      return;
    }

    res.json({ ok: true });
  };

  replacePermissions = async (req: Request, res: Response) => {
    const roleId = String(req.params.id ?? "");
    const permissionIds = normalizePermissionIds(req.body.permissions);

    if (permissionIds.length === 0) {
      res.status(400).json({ message: "Rol üzerinde en az bir izin kalmalıdır." });
      return;
    }

    await this.service.replacePermissions(req, roleId, permissionIds);
    res.json({ ok: true });
  };
}
