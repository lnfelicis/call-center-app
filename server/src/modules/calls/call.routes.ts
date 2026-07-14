import { Router, type RequestHandler } from "express";
import {
  createCallController,
  type CallControllerDependencies,
} from "./call.controller.js";

export type CallRoutesDependencies = CallControllerDependencies & {
  requireAuth: RequestHandler;
  requireAnyPermission: (permissions: string[]) => RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
};

export function createCallRoutes(dependencies: CallRoutesDependencies) {
  const router = Router();
  const controller = createCallController(dependencies);

  router.use(dependencies.requireAuth);
  router.get(
    "/call-options",
    dependencies.requireAnyPermission(["calls.create", "calls.edit", "calls.resolve", "settings.manage"]),
    controller.getCallOptions,
  );
  router.post(
    "/call-options",
    dependencies.requirePermission("settings.manage"),
    controller.createCallOption,
  );
  router.patch(
    "/call-options",
    dependencies.requirePermission("settings.manage"),
    controller.bulkUpdateCallOptions,
  );
  router.patch(
    "/call-options/:id",
    dependencies.requirePermission("settings.manage"),
    controller.updateCallOption,
  );
  router.get(
    "/calls/assignees",
    dependencies.requireAnyPermission(["calls.assign", "calls.create"]),
    controller.getAssignees,
  );
  router.get(
    "/calls",
    dependencies.requireAnyPermission(["calls.view.own", "calls.view.all", "calls.create"]),
    controller.listCalls,
  );
  router.post(
    "/calls",
    dependencies.requirePermission("calls.create"),
    controller.createCall,
  );
  router.get(
    "/calls/matches",
    dependencies.requirePermission("calls.create"),
    controller.matchCalls,
  );
  router.get("/calls/:id", controller.getCall);
  router.patch(
    "/calls/:id",
    dependencies.requirePermission("calls.edit"),
    controller.updateCall,
  );
  router.post("/calls/:id/notes", controller.addNote);
  router.patch(
    "/calls/:id/assign",
    dependencies.requirePermission("calls.assign"),
    controller.assignCall,
  );
  router.patch(
    "/calls/:id/status",
    dependencies.requirePermission("calls.edit"),
    controller.updateCallStatus,
  );
  router.post(
    "/calls/:id/resolve",
    dependencies.requirePermission("calls.resolve"),
    controller.resolveCall,
  );
  router.post(
    "/calls/:id/reopen",
    dependencies.requirePermission("calls.reopen"),
    controller.reopenCall,
  );

  return router;
}
