import { describe, expect, it } from "vitest";
import type {
  CallOptionRow,
  UserOptionRow,
} from "../../../src/modules/calls/call.types.js";
import { createField } from "./call-fixtures.js";
import {
  createControllerHarness,
  createControllerRequest,
  createControllerResponse,
  expectControllerResponse,
} from "./controller-harness.js";

describe("call controller options and assignees", () => {
  it("serializes call options and field settings with exact response keys", async () => {
    const harness = createControllerHarness();
    const option = {
      id: "option-1",
      option_type: "priority",
      label: "Normal",
      value: null,
      color: "#ffffff",
      is_active: 1,
      sort_order: 2,
    } as CallOptionRow;
    harness.query.mockResolvedValueOnce([[option], []]);
    harness.repositoryMocks.getFieldSettings.mockResolvedValueOnce([
      createField("phoneNumber", { label: "Telefon", is_required: 1 }),
    ]);
    const response = createControllerResponse();

    await harness.controller.getCallOptions(createControllerRequest(), response);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      options: [{
        id: "option-1",
        type: "priority",
        label: "Normal",
        value: "Normal",
        color: "#ffffff",
        isActive: true,
        sortOrder: 2,
      }],
      fields: [{
        key: "phoneNumber",
        label: "Telefon",
        isActive: true,
        isRequired: true,
        isVisible: true,
        isEditable: true,
        isMasked: false,
        sortOrder: 0,
      }],
    });
    expect(Object.keys(response.json.mock.calls[0]![0] as object)).toStrictEqual(["options", "fields"]);
  });

  it("rejects an unsupported option type before writing", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.createCallOption(createControllerRequest({
      body: { type: "issue_sub_category", label: "Sub category" },
    }), response);

    expectControllerResponse(response, 400, { message: "Geçersiz seçenek türü." });
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("rejects a short option label before writing", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.createCallOption(createControllerRequest({
      body: { type: "status", label: " A " },
    }), response);

    expectControllerResponse(response, 400, {
      message: "Seçenek adı en az 2 karakter olmalıdır.",
    });
  });

  it("rejects invalid status and priority colors", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.createCallOption(createControllerRequest({
      body: { type: "priority", label: "Urgent", color: "red" },
    }), response);

    expectControllerResponse(response, 400, {
      message: "Renk değeri #RRGGBB formatında olmalıdır.",
    });
  });

  it("creates an option with legacy value, color and sort coercion", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.createCallOption(createControllerRequest({
      body: {
        type: "status",
        label: " In Progress ",
        value: " ",
        color: "#ABCDEF",
        sortOrder: "not-a-number",
      },
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO call_form_options"),
      ["generated-id", "status", "In Progress", "in_progress", "#abcdef", 0],
    );
    expect(harness.auditWriter).toHaveBeenCalledWith(expect.objectContaining({
      action: "call_option.create",
      entityType: "call_form_option",
      metadata: {
        type: "status",
        label: "In Progress",
        value: "in_progress",
        color: "#abcdef",
      },
    }));
    expectControllerResponse(response, 201, { ok: true });
  });

  it("returns the exact empty bulk-options validation response", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.bulkUpdateCallOptions(createControllerRequest({
      body: { options: "not-an-array" },
    }), response);

    expectControllerResponse(response, 400, {
      message: "Kaydedilecek seçenek bulunamadı.",
    });
    expect(harness.database.getConnection).not.toHaveBeenCalled();
  });

  it.each([
    [{ id: "", type: "status", label: "Open" }],
    [{ id: "option-1", type: "unknown", label: "Open" }],
    [{ id: "option-1", type: "status", label: "A" }],
  ])("rejects invalid bulk option records before opening a transaction", async (option) => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.bulkUpdateCallOptions(createControllerRequest({
      body: { options: [option] },
    }), response);

    expectControllerResponse(response, 400, {
      message: "Seçenek listesinde geçersiz kayıt var.",
    });
    expect(harness.database.getConnection).not.toHaveBeenCalled();
  });

  it("rejects an invalid bulk option color before opening a transaction", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.bulkUpdateCallOptions(createControllerRequest({
      body: {
        options: [{ id: "option-1", type: "status", label: "Open", color: "red" }],
      },
    }), response);

    expectControllerResponse(response, 400, {
      message: "Renk değeri #RRGGBB formatında olmalıdır.",
    });
    expect(harness.database.getConnection).not.toHaveBeenCalled();
  });

  it("rolls back and releases a failed bulk update without auditing", async () => {
    const harness = createControllerHarness();
    const failure = new Error("update failed");
    harness.connection.query.mockRejectedValueOnce(failure);
    const response = createControllerResponse();

    await expect(harness.controller.bulkUpdateCallOptions(createControllerRequest({
      body: {
        options: [{
          id: "option-1",
          type: "status",
          label: "Open",
          color: null,
          isActive: false,
          sortOrder: 1,
        }],
      },
    }), response)).rejects.toBe(failure);

    expect(harness.connection.beginTransaction).toHaveBeenCalledOnce();
    expect(harness.connection.rollback).toHaveBeenCalledOnce();
    expect(harness.connection.commit).not.toHaveBeenCalled();
    expect(harness.connection.release).toHaveBeenCalledOnce();
    expect(harness.auditWriter).not.toHaveBeenCalled();
  });

  it("validates single-option updates before querying", async () => {
    const shortLabelHarness = createControllerHarness();
    const shortLabelResponse = createControllerResponse();
    await shortLabelHarness.controller.updateCallOption(createControllerRequest({
      params: { id: "option-1" },
      body: { type: "status", label: "A" },
    }), shortLabelResponse);
    expectControllerResponse(shortLabelResponse, 400, {
      message: "Seçenek adı en az 2 karakter olmalıdır.",
    });

    const colorHarness = createControllerHarness();
    const colorResponse = createControllerResponse();
    await colorHarness.controller.updateCallOption(createControllerRequest({
      params: { id: "option-1" },
      body: { type: "status", label: "Open", color: "invalid" },
    }), colorResponse);
    expectControllerResponse(colorResponse, 400, {
      message: "Renk değeri #RRGGBB formatında olmalıdır.",
    });
  });

  it("returns 404 when a single-option update affects no rows", async () => {
    const harness = createControllerHarness();
    harness.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    const response = createControllerResponse();

    await harness.controller.updateCallOption(createControllerRequest({
      params: { id: "missing-option" },
      body: { type: "status", label: "Open", isActive: false, sortOrder: 2 },
    }), response);

    expectControllerResponse(response, 404, { message: "Seçenek bulunamadı." });
    expect(harness.auditWriter).not.toHaveBeenCalled();
  });

  it("updates and audits a single option with exact SQL params", async () => {
    const harness = createControllerHarness();
    harness.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const response = createControllerResponse();

    await harness.controller.updateCallOption(createControllerRequest({
      params: { id: "option-1" },
      body: {
        type: "priority",
        label: " Urgent ",
        value: "urgent-custom",
        color: "#FEDCBA",
        isActive: false,
        sortOrder: "3",
      },
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      ["Urgent", "urgent-custom", "#fedcba", 0, 3, "option-1"],
    );
    expect(harness.auditWriter).toHaveBeenCalledWith(expect.objectContaining({
      action: "call_option.update",
      entityId: "option-1",
      metadata: {
        label: "Urgent",
        value: "urgent-custom",
        color: "#fedcba",
        isActive: false,
        sortOrder: 3,
      },
    }));
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it("serializes active assignees", async () => {
    const harness = createControllerHarness();
    const user = {
      id: "user-2",
      full_name: "Agent Two",
      username: "agent2",
    } as UserOptionRow;
    harness.query.mockResolvedValueOnce([[user], []]);
    const response = createControllerResponse();

    await harness.controller.getAssignees(createControllerRequest(), response);

    expect(harness.query).toHaveBeenCalledWith(expect.stringContaining(
      "WHERE status = 'active'",
    ));
    expect(response.json).toHaveBeenCalledWith({
      users: [{ id: "user-2", fullName: "Agent Two", username: "agent2" }],
    });
  });
});
