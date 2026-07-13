import type { Request, Response } from "express";
import type { AuthService } from "./service.js";
import type { AuthenticatedRequest } from "./types.js";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response) => {
    const username = String(req.body.username ?? "").trim();
    const password = String(req.body.password ?? "");

    if (!username || !password) {
      res.status(400).json({ message: "Kullanıcı adı ve şifre zorunludur." });
      return;
    }

    const result = await this.service.login(req, username, password);

    if (result.type === "ip-not-allowed") {
      res.status(403).json({ message: "Bu IP adresinden girişe izin verilmiyor." });
      return;
    }

    if (result.type === "invalid-credentials") {
      res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı." });
      return;
    }

    if (result.type === "blocked") {
      res.status(423).json({
        message: "Hatalı giriş limiti aşıldı. Yönetici ile iletişime geçin.",
      });
      return;
    }

    if (result.type === "inactive-role") {
      res.status(401).json({ message: "Kullanıcı rolü aktif değil." });
      return;
    }

    res.json({
      token: result.token,
      user: result.user,
    });
  };

  logout = async (req: AuthenticatedRequest, res: Response) => {
    await this.service.logout(req, req.user?.id);
    res.json({ ok: true });
  };

  me = (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  };
}
