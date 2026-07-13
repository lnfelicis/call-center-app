import { Router, type RequestHandler } from "express";
import type { AuthController } from "./controller.js";

export type AuthRoutesDependencies = {
  controller: AuthController;
  requireAuth: RequestHandler;
};

export function createAuthRoutes({ controller, requireAuth }: AuthRoutesDependencies) {
  const router = Router();

  router.post("/login", controller.login);
  router.post("/logout", requireAuth, controller.logout);
  router.get("/me", requireAuth, controller.me);

  return router;
}
