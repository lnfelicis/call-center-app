import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { SettingsController } from "../../../src/modules/settings/controller.js";
import type { SettingsService } from "../../../src/modules/settings/service.js";

function createResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function createController() {
  const service = {
    readSettings: vi.fn().mockResolvedValue({ options: [], fields: [] }),
    readSecuritySettings: vi.fn().mockResolvedValue({ security: "security" }),
    updateSecuritySettings: vi.fn().mockResolvedValue({ security: "updated" }),
    updateSettings: vi.fn().mockResolvedValue({ body: { saved: true } }),
    getOptions: vi.fn().mockResolvedValue({ body: { options: [] } }),
    createOption: vi.fn().mockResolvedValue({ status: 201, body: { id: "option-id" } }),
    updateOption: vi.fn().mockResolvedValue({ status: 404, body: { message: "missing" } }),
  } as unknown as SettingsService;
  return { service, controller: new SettingsController(service) };
}

describe("SettingsController", () => {
  it("serializes all direct read and security-update service results", async () => {
    const { controller, service } = createController();
    const req = { body: { security: {} } } as Request;
    const readResponse = createResponse();
    const securityResponse = createResponse();
    const updateResponse = createResponse();

    await controller.getSettings(req, readResponse);
    await controller.getSecurity(req, securityResponse);
    await controller.updateSecurity(req, updateResponse);

    expect(readResponse.json).toHaveBeenCalledWith({ options: [], fields: [] });
    expect(securityResponse.json).toHaveBeenCalledWith({ security: "security" });
    expect(updateResponse.json).toHaveBeenCalledWith({ security: "updated" });
    expect(service.updateSecuritySettings).toHaveBeenCalledWith(req);
  });

  it("uses the service status for settings and option mutations", async () => {
    const { controller, service } = createController();
    vi.mocked(service.updateSettings).mockResolvedValueOnce({
      status: 400,
      body: { message: "invalid" },
    });
    const req = { params: { type: "status", id: "option-id" }, body: {} } as unknown as Request;
    const settingsResponse = createResponse();
    const optionCreateResponse = createResponse();
    const updateResponse = createResponse();

    await controller.updateSettings(req, settingsResponse);
    await controller.createOption(req, optionCreateResponse);
    await controller.updateOption(req, updateResponse);

    expect(settingsResponse.status).toHaveBeenCalledWith(400);
    expect(settingsResponse.json).toHaveBeenCalledWith({ message: "invalid" });
    expect(optionCreateResponse.status).toHaveBeenCalledWith(201);
    expect(optionCreateResponse.json).toHaveBeenCalledWith({ id: "option-id" });
    expect(updateResponse.status).toHaveBeenCalledWith(404);
    expect(updateResponse.json).toHaveBeenCalledWith({ message: "missing" });
    expect(service.createOption).toHaveBeenCalledWith(req);
    expect(service.updateOption).toHaveBeenCalledWith(req);
  });

  it("uses a plain 200 JSON result when the service omits status", async () => {
    const { controller, service } = createController();
    vi.mocked(service.updateOption).mockResolvedValueOnce({ body: { ok: true } });
    const req = { params: { type: "status", id: "option-id" }, body: {} } as unknown as Request;
    const settingsResponse = createResponse();
    const optionsResponse = createResponse();
    const updateResponse = createResponse();

    await controller.updateSettings(req, settingsResponse);
    await controller.getOptions(req, optionsResponse);
    await controller.updateOption(req, updateResponse);

    expect(settingsResponse.status).not.toHaveBeenCalled();
    expect(settingsResponse.json).toHaveBeenCalledWith({ saved: true });
    expect(optionsResponse.status).not.toHaveBeenCalled();
    expect(optionsResponse.json).toHaveBeenCalledWith({ options: [] });
    expect(updateResponse.status).not.toHaveBeenCalled();
    expect(updateResponse.json).toHaveBeenCalledWith({ ok: true });
    expect(service.getOptions).toHaveBeenCalledWith("status");
  });
});
