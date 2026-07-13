import { describe, expect, it, vi } from "vitest";
import type { SettingsController } from "../../../src/modules/settings/controller.js";
import { createSettingRoutes } from "../../../src/modules/settings/routes.js";
import type { requireAuth, requirePermission } from "../../../src/auth.js";

describe("createSettingRoutes", () => {
  it("registers the seven preserved settings routes behind one permission", () => {
    const handler = vi.fn();
    const authenticate = vi.fn() as unknown as typeof requireAuth;
    const authorize = vi.fn().mockReturnValue(handler) as unknown as typeof requirePermission;
    const controller = {
      getSettings: handler,
      getSecurity: handler,
      updateSecurity: handler,
      updateSettings: handler,
      getOptions: handler,
      createOption: handler,
      updateOption: handler,
    } as unknown as SettingsController;

    const router = createSettingRoutes({ controller, authenticate, authorize });
    const endpoints = (
      router.stack as unknown as Array<{
        route?: { path: string; methods: Record<string, boolean> };
      }>
    ).flatMap((layer) =>
      layer.route
        ? [{ path: layer.route.path, methods: Object.keys(layer.route.methods) }]
        : [],
    );

    expect(authorize).toHaveBeenCalledTimes(7);
    expect(authorize).toHaveBeenCalledWith("settings.manage");
    expect(endpoints).toStrictEqual([
      { path: "/settings", methods: ["get"] },
      { path: "/settings/security", methods: ["get"] },
      { path: "/settings/security", methods: ["patch"] },
      { path: "/settings", methods: ["patch"] },
      { path: "/settings/options/:type", methods: ["get"] },
      { path: "/settings/options/:type", methods: ["post"] },
      { path: "/settings/options/:type/:id", methods: ["patch"] },
    ]);
  });
});
