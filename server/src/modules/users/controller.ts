import type { Request, Response } from "express";
import { parsePermissionOverrides } from "./policy.js";
import type { UserService } from "./service.js";
import type { UserListScope } from "./types.js";

export type UserControllerDependencies = {
  service: UserService;
  getPasswordValidationErrors: (password: string) => string[];
};

export class UserController {
  constructor(private readonly dependencies: UserControllerDependencies) {}

  options = async (_req: Request, res: Response) => {
    res.json({ users: await this.dependencies.service.listActive() });
  };

  list = async (req: Request, res: Response) => {
    const requestedScope = String(req.query?.scope ?? "current");
    const scope: UserListScope = requestedScope === "all" || requestedScope === "archived"
      ? requestedScope
      : "current";
    res.json({ users: await this.dependencies.service.listAll(scope) });
  };

  create = async (req: Request, res: Response) => {
    const username = String(req.body.username ?? "").trim();
    const fullName = String(req.body.fullName ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const password = String(req.body.password ?? "");
    const roleId = String(req.body.roleId ?? "");
    const parsedOverrides = parsePermissionOverrides(req.body.permissionOverrides ?? [], {
      optional: false,
    });

    if (!username || !fullName || !email || !password || !roleId) {
      res.status(400).json({
        message: "Kullanıcı adı, ad soyad, e-posta, şifre ve rol zorunludur.",
      });
      return;
    }

    if (!parsedOverrides.valid || parsedOverrides.value === undefined) {
      res.status(400).json({ message: "Kullanıcı izin istisnaları geçersiz." });
      return;
    }

    const passwordErrors = this.dependencies.getPasswordValidationErrors(password);

    if (passwordErrors.length > 0) {
      res.status(400).json({ message: passwordErrors.join(" ") });
      return;
    }

    const userId = await this.dependencies.service.create(req, {
      username,
      fullName,
      email,
      password,
      roleId,
      permissionOverrides: parsedOverrides.value,
    });

    res.status(201).json({ id: userId });
  };

  update = async (req: Request, res: Response) => {
    const userId = String(req.params.id ?? "");
    const fullName = String(req.body.fullName ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const roleId = String(req.body.roleId ?? "");
    const status = req.body.status === "passive" ? "passive" : "active";
    const parsedOverrides = parsePermissionOverrides(req.body.permissionOverrides, {
      optional: true,
    });

    if (!fullName || !email || !roleId) {
      res.status(400).json({ message: "Ad soyad, e-posta ve rol zorunludur." });
      return;
    }


    if (!parsedOverrides.valid) {
      res.status(400).json({ message: "Kullanıcı izin istisnaları geçersiz." });
      return;
    }

    const updated = await this.dependencies.service.update(req, {
      userId,
      fullName,
      email,
      roleId,
      status,
      ...(parsedOverrides.value === undefined
        ? {}
        : { permissionOverrides: parsedOverrides.value }),
    });

    if (!updated) {
      res.status(404).json({ message: "Kullanıcı bulunamadı." });
      return;
    }

    res.json({ ok: true });
  };

  changePassword = async (req: Request, res: Response) => {
    const userId = String(req.params.id ?? "");
    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = String(req.body.newPassword ?? "");

    if (!userId || !newPassword) {
      res.status(400).json({ message: "Yeni şifre zorunludur.", field: "newPassword" });
      return;
    }

    const passwordErrors = this.dependencies.getPasswordValidationErrors(newPassword);
    if (passwordErrors.length > 0) {
      res.status(400).json({ message: passwordErrors.join(" "), field: "newPassword" });
      return;
    }

    await this.dependencies.service.changePassword(req, {
      userId,
      currentPassword,
      newPassword,
    });
    res.json({ ok: true });
  };

  archive = async (req: Request, res: Response) => {
    const archived = await this.dependencies.service.archive(req, String(req.params.id ?? ""));
    if (!archived) {
      res.status(404).json({ message: "Kullanıcı bulunamadı veya zaten silinmiş." });
      return;
    }
    res.json({ ok: true });
  };

  restore = async (req: Request, res: Response) => {
    const restored = await this.dependencies.service.restore(req, String(req.params.id ?? ""));
    if (!restored) {
      res.status(404).json({ message: "Silinmiş kullanıcı bulunamadı." });
      return;
    }
    res.json({ ok: true });
  };
}
