import { describe, expect, it } from "vitest";
import {
  createControllerHarness,
  createControllerRequest,
  createControllerResponse,
} from "./controller-harness.js";

describe("call controller partial-write failure behavior", () => {
  it("propagates option audit failure after the option insert", async () => {
    const harness = createControllerHarness();
    const order: string[] = [];
    const failure = new Error("audit failed");
    harness.query.mockImplementationOnce(async () => {
      order.push("insert");
      return [{}, []];
    });
    harness.auditWriter.mockImplementationOnce(async () => {
      order.push("audit");
      throw failure;
    });
    const response = createControllerResponse();

    await expect(harness.controller.createCallOption(createControllerRequest({
      body: { type: "issue_category", label: "Registration" },
    }), response)).rejects.toBe(failure);

    expect(order).toStrictEqual(["insert", "audit"]);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("propagates urgent notification failure after insert, event and audit but before reload", async () => {
    const harness = createControllerHarness();
    const order: string[] = [];
    const failure = new Error("notification failed");
    harness.query.mockImplementationOnce(async () => {
      order.push("insert");
      return [{}, []];
    });
    harness.repositoryMocks.writeCallEvent.mockImplementationOnce(async () => {
      order.push("event");
    });
    harness.auditWriter.mockImplementationOnce(async () => {
      order.push("audit");
    });
    harness.notificationSettingsReader.mockImplementationOnce(async () => {
      order.push("settings");
      return { urgentNotificationEnabled: true };
    });
    harness.notificationPublisher.mockImplementationOnce(async () => {
      order.push("notification");
      throw failure;
    });
    const response = createControllerResponse();

    await expect(harness.controller.createCall(createControllerRequest({
      body: {
        interactionType: "phone",
        category: "general",
        issue: "Issue",
        priority: "urgent",
      },
    }), response)).rejects.toBe(failure);

    expect(order).toStrictEqual(["insert", "event", "audit", "settings", "notification"]);
    expect(harness.repositoryMocks.getCallById).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("leaves resolve primary update outside a transaction when note insertion fails", async () => {
    const harness = createControllerHarness();
    const order: string[] = [];
    const failure = new Error("note insert failed");
    harness.query
      .mockImplementationOnce(async () => {
        order.push("update");
        return [{}, []];
      })
      .mockImplementationOnce(async () => {
        order.push("note");
        throw failure;
      });
    const response = createControllerResponse();

    await expect(harness.controller.resolveCall(createControllerRequest({
      params: { id: "call-1" },
      body: {
        resolutionDescription: "Resolved",
        resolutionCategory: "solved",
      },
    }), response)).rejects.toBe(failure);

    expect(order).toStrictEqual(["update", "note"]);
    expect(harness.database.getConnection).not.toHaveBeenCalled();
    expect(harness.repositoryMocks.writeCallEvent).not.toHaveBeenCalled();
    expect(harness.auditWriter).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("propagates assignment audit failure after update and event", async () => {
    const harness = createControllerHarness();
    const order: string[] = [];
    const failure = new Error("audit failed");
    harness.query
      .mockResolvedValueOnce([[{
        id: "user-2",
        full_name: "User Two",
        username: "user.two",
      }], []])
      .mockImplementationOnce(async () => {
        order.push("update");
        return [{}, []];
      });
    harness.repositoryMocks.writeCallEvent.mockImplementationOnce(async () => {
      order.push("event");
    });
    harness.auditWriter.mockImplementationOnce(async () => {
      order.push("audit");
      throw failure;
    });
    const response = createControllerResponse();

    await expect(harness.controller.assignCall(createControllerRequest({
      params: { id: "call-1" },
      body: { assignedToUserId: "user-2" },
      permissions: ["calls.view.all"],
    }), response)).rejects.toBe(failure);

    expect(order).toStrictEqual(["update", "event", "audit"]);
    expect(response.json).not.toHaveBeenCalled();
  });
});
