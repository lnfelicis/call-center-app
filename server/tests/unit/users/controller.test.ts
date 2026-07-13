import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserController } from "../../../src/modules/users/controller.js";
import type { UserService } from "../../../src/modules/users/service.js";

function createResponse() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

function createService() {
  return {
    listActive: vi.fn().mockResolvedValue([{ id: "user-1" }]),
    listAll: vi.fn().mockResolvedValue([{ id: "user-2" }]),
    create: vi.fn().mockResolvedValue("user-3"),
    update: vi.fn().mockResolvedValue(true),
  } as unknown as UserService;
}

describe("user controller", () => {
  let service: UserService;
  let getPasswordValidationErrors: ReturnType<typeof vi.fn<(password: string) => string[]>>;

  beforeEach(() => {
    service = createService();
    getPasswordValidationErrors = vi.fn<(password: string) => string[]>().mockReturnValue([]);
  });

  it("returns active options and all users in existing envelopes", async () => {
    const controller = new UserController({ service, getPasswordValidationErrors });
    const optionsResponse = createResponse();
    const listResponse = createResponse();

    await controller.options({} as Request, optionsResponse);
    await controller.list({} as Request, listResponse);

    expect(optionsResponse.json).toHaveBeenCalledWith({ users: [{ id: "user-1" }] });
    expect(listResponse.json).toHaveBeenCalledWith({ users: [{ id: "user-2" }] });
  });

  it("validates required create fields before password rules", async () => {
    const response = createResponse();
    await new UserController({ service, getPasswordValidationErrors }).create(
      { body: { username: " " } } as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Kullanıcı adı, ad soyad, e-posta, şifre ve rol zorunludur.",
    });
    expect(getPasswordValidationErrors).not.toHaveBeenCalled();
  });

  it("joins password errors without changing their order", async () => {
    getPasswordValidationErrors.mockReturnValue(["İlk hata.", "İkinci hata."]);
    const response = createResponse();

    await new UserController({ service, getPasswordValidationErrors }).create(
      {
        body: {
          username: "omer",
          fullName: "Ömer Test",
          email: "omer@example.test",
          password: "weak",
          roleId: "role-1",
        },
      } as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "İlk hata. İkinci hata." });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("coerces and trims create input before returning 201", async () => {
    const request = {
      body: {
        username: " omer ",
        fullName: " Ömer Test ",
        email: " omer@example.test ",
        password: 123,
        roleId: 7,
      },
    } as unknown as Request;
    const response = createResponse();

    await new UserController({ service, getPasswordValidationErrors }).create(request, response);

    expect(service.create).toHaveBeenCalledWith(request, {
      username: "omer",
      fullName: "Ömer Test",
      email: "omer@example.test",
      password: "123",
      roleId: "7",
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ id: "user-3" });
  });

  it("validates required update fields", async () => {
    const response = createResponse();
    await new UserController({ service, getPasswordValidationErrors }).update(
      { params: { id: "user-1" }, body: {} } as unknown as Request,
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Ad soyad, e-posta ve rol zorunludur.",
    });
  });

  it("returns 404 without changing the update response", async () => {
    vi.mocked(service.update).mockResolvedValue(false);
    const response = createResponse();

    await new UserController({ service, getPasswordValidationErrors }).update(
      {
        params: { id: "missing" },
        body: { fullName: "Ömer", email: "o@example.test", roleId: "role-1" },
      } as unknown as Request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Kullanıcı bulunamadı." });
  });

  it.each([["passive", "passive"], ["false", "active"]] as const)(
    "coerces status %s to %s and returns ok",
    async (inputStatus, expectedStatus) => {
      const request = {
        params: { id: "user-1" },
        body: {
          fullName: " Ömer Test ",
          email: " omer@example.test ",
          roleId: 7,
          status: inputStatus,
        },
      } as unknown as Request;
      const response = createResponse();

      await new UserController({ service, getPasswordValidationErrors }).update(request, response);

      expect(service.update).toHaveBeenCalledWith(request, {
        userId: "user-1",
        fullName: "Ömer Test",
        email: "omer@example.test",
        roleId: "7",
        status: expectedStatus,
      });
      expect(response.json).toHaveBeenCalledWith({ ok: true });
    },
  );
});
