import type { Request, Response } from "express";
import type { UserService } from "./service.js";

export type UserControllerDependencies = {
  service: UserService;
  getPasswordValidationErrors: (password: string) => string[];
};

export class UserController {
  constructor(private readonly dependencies: UserControllerDependencies) {}

  options = async (_req: Request, res: Response) => {
    res.json({ users: await this.dependencies.service.listActive() });
  };

  list = async (_req: Request, res: Response) => {
    res.json({ users: await this.dependencies.service.listAll() });
  };

  create = async (req: Request, res: Response) => {
    const username = String(req.body.username ?? "").trim();
    const fullName = String(req.body.fullName ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const password = String(req.body.password ?? "");
    const roleId = String(req.body.roleId ?? "");

    if (!username || !fullName || !email || !password || !roleId) {
      res.status(400).json({
        message: "Kullanıcı adı, ad soyad, e-posta, şifre ve rol zorunludur.",
      });
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
    });

    res.status(201).json({ id: userId });
  };

  update = async (req: Request, res: Response) => {
    const userId = String(req.params.id ?? "");
    const fullName = String(req.body.fullName ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const roleId = String(req.body.roleId ?? "");
    const status = req.body.status === "passive" ? "passive" : "active";

    if (!fullName || !email || !roleId) {
      res.status(400).json({ message: "Ad soyad, e-posta ve rol zorunludur." });
      return;
    }

    const updated = await this.dependencies.service.update(req, {
      userId,
      fullName,
      email,
      roleId,
      status,
    });

    if (!updated) {
      res.status(404).json({ message: "Kullanıcı bulunamadı." });
      return;
    }

    res.json({ ok: true });
  };
}
