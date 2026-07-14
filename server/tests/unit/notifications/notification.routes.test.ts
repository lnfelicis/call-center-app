import { describe, expect, it, vi } from "vitest";
import type { RequestHandler } from "express";
import type { NotificationController } from "../../../src/modules/notifications/controller.js";
import { createNotificationRoutes } from "../../../src/modules/notifications/routes.js";

describe("createNotificationRoutes", () => {
  it("registers list and mark-read behind notifications.view", () => {
    const handler = vi.fn();
    const authenticate = vi.fn() as unknown as RequestHandler;
    const authorize = vi.fn().mockReturnValue(handler) as unknown as (
      permission: string,
    ) => RequestHandler;
    const controller = { list: handler, markRead: handler } as unknown as NotificationController;

    const router = createNotificationRoutes({ controller, authenticate, authorize });
    const endpoints = (
      router.stack as unknown as Array<{
        route?: { path: string; methods: Record<string, boolean> };
      }>
    ).flatMap((layer) =>
      layer.route
        ? [{ path: layer.route.path, methods: Object.keys(layer.route.methods) }]
        : [],
    );

    expect(authorize).toHaveBeenCalledTimes(2);
    expect(authorize).toHaveBeenCalledWith("notifications.view");
    expect(endpoints).toStrictEqual([
      { path: "/notifications", methods: ["get"] },
      { path: "/notifications/:id/read", methods: ["patch"] },
    ]);
  });
});
