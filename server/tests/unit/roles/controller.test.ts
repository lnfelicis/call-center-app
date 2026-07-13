import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleController } from "../../../src/modules/roles/controller.js";
import type { RoleService } from "../../../src/modules/roles/service.js";

function createResponse() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

function createService() {
  return {
    listPermissions: vi.fn().mockResolvedValue([{ id: "users.manage" }]),
    listRoles: vi.fn().mockResolvedValue([{ id: "role-1" }]),
    create: vi.fn().mockResolvedValue("role-2"),
    update: vi.fn().mockResolvedValue(true),
    replacePermissions: vi.fn().mockResolvedValue(undefined),
  } as unknown as RoleService;
}

describe("role controller", () => {
  let service: RoleService;

  beforeEach(() => {
    service = createService();
  });

  it("returns permission and role envelopes", async () => {
    const controller = new RoleController(service);
    const permissionResponse = createResponse();
    const roleResponse = createResponse();

    await controller.permissions({} as Request, permissionResponse);
    await controller.list({} as Request, roleResponse);

    expect(permissionResponse.json).toHaveBeenCalledWith({ permissions: [{ id: "users.manage" }] });
    expect(roleResponse.json).toHaveBeenCalledWith({ roles: [{ id: "role-1" }] });
  });

  it("validates role name before permission selection", async () => {
    const response = createResponse();
    await new RoleController(service).create(
      { body: { name: " x ", permissions: [] } } as Request,
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Rol adı en az 2 karakter olmalıdır." });
  });

  it("requires at least one permission for role creation", async () => {
    const response = createResponse();
    await new RoleController(service).create(
      { body: { name: "Yönetici", permissions: "users.manage" } } as Request,
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Rol oluşturmak için en az bir izin seçilmelidir.",
    });
  });

  it("coerces create input and returns 201", async () => {
    const request = {
      body: { name: " Yönetici ", description: " Açıklama ", permissions: [7, "logs.view"] },
    } as unknown as Request;
    const response = createResponse();

    await new RoleController(service).create(request, response);

    expect(service.create).toHaveBeenCalledWith(request, {
      name: "Yönetici",
      description: "Açıklama",
      permissionIds: ["7", "logs.view"],
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ id: "role-2" });
  });

  it("validates role name on update", async () => {
    const response = createResponse();
    await new RoleController(service).update(
      { params: { id: "role-1" }, body: { name: "x" } } as unknown as Request,
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("returns 404 when no role is updated", async () => {
    vi.mocked(service.update).mockResolvedValue(false);
    const response = createResponse();
    await new RoleController(service).update(
      { params: { id: "missing" }, body: { name: "Rol", isActive: false } } as unknown as Request,
      response,
    );
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Rol bulunamadı." });
  });

  it("preserves Boolean coercion and nullable description on update", async () => {
    const request = {
      params: { id: "role-1" },
      body: { name: " Rol ", description: " ", isActive: "false" },
    } as unknown as Request;
    const response = createResponse();

    await new RoleController(service).update(request, response);

    expect(service.update).toHaveBeenCalledWith(request, {
      roleId: "role-1",
      name: "Rol",
      description: null,
      isActive: true,
    });
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it("requires at least one permission on replacement", async () => {
    const response = createResponse();
    await new RoleController(service).replacePermissions(
      { params: { id: "role-1" }, body: { permissions: [] } } as unknown as Request,
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Rol üzerinde en az bir izin kalmalıdır.",
    });
  });

  it("replaces normalized permissions and returns ok", async () => {
    const request = {
      params: { id: "role-1" },
      body: { permissions: ["users.manage"] },
    } as unknown as Request;
    const response = createResponse();

    await new RoleController(service).replacePermissions(request, response);

    expect(service.replacePermissions).toHaveBeenCalledWith(request, "role-1", ["users.manage"]);
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });
});
