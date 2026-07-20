import { describe, expect, it } from "vitest";
import { createCallRow, createField } from "./call-fixtures.js";
import {
  createControllerHarness,
  createControllerRequest,
  createControllerResponse,
  expectControllerResponse,
} from "./controller-harness.js";

describe("call controller update", () => {
  it("rejects locked records", async () => {
    const harness = createControllerHarness();
    harness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      opened_by_user_id: "user-1",
      is_locked: 1,
    }));
    const response = createControllerResponse();

    await harness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      permissions: ["calls.view.own"],
    }), response);

    expectControllerResponse(response, 400, { message: "Kilitli kayıt düzenlenemez." });
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("preserves required, phone, identity and follow-up validation responses", async () => {
    const requiredHarness = createControllerHarness();
    requiredHarness.repositoryMocks.getFieldSettings.mockResolvedValueOnce([
      createField("phoneNumber", { label: "Telefon", is_required: 1 }),
    ]);
    const requiredResponse = createControllerResponse();
    await requiredHarness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      body: { phoneNumber: " " },
    }), requiredResponse);
    expectControllerResponse(requiredResponse, 400, { message: "Telefon zorunludur." });

    const phoneHarness = createControllerHarness();
    const phoneResponse = createControllerResponse();
    await phoneHarness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      body: { phoneNumber: "123" },
    }), phoneResponse);
    expectControllerResponse(phoneResponse, 400, {
      message: "Telefon numarası formatı geçerli değil.",
    });

    const tcHarness = createControllerHarness();
    const tcResponse = createControllerResponse();
    await tcHarness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      body: { studentTc: "10000000145" },
    }), tcResponse);
    expectControllerResponse(tcResponse, 400, { message: "Geçerli bir TC Kimlik No girin." });

    const followUpHarness = createControllerHarness();
    const followUpResponse = createControllerResponse();
    await followUpHarness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      body: { needsFollowUp: true, followUpAt: " " },
    }), followUpResponse);
    expectControllerResponse(followUpResponse, 400, {
      message: "Takip gerekiyorsa takip tarihi zorunludur.",
    });
  });

  it("updates every editable field, reports changed keys and notifies urgent escalation", async () => {
    const harness = createControllerHarness();
    const original = createCallRow({
      opened_by_user_id: "user-1",
      student_tc: null,
      student_name: null,
      initial_note: null,
    });
    const updated = createCallRow({
      opened_by_user_id: "user-1",
      phone_number: "05551112233",
      student_tc: "10000000146",
      student_name: "New Student",
      interaction_type: "email",
      category: "general",
      issue: "New issue",
      initial_note: "New note",
      priority: "urgent",
      needs_follow_up: 1,
      follow_up_at: "2026-07-20 10:00:00",
    });
    harness.repositoryMocks.getCallById
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(updated);
    harness.notificationSettingsReader.mockResolvedValueOnce({
      urgentNotificationEnabled: true,
    });
    const response = createControllerResponse();

    await harness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      body: {
        phoneNumber: " 05551112233 ",
        studentTc: "10000000146",
        studentName: " New Student ",
        interactionType: " email ",
        category: " general ",
        issue: " New issue ",
        initialNote: " New note ",
        priority: "urgent",
        needsFollowUp: "true",
        followUpAt: " 2026-07-20 10:00:00 ",
      },
      permissions: ["calls.view.own"],
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining("SET phone_number = ?"),
      [
        "05551112233",
        "10000000146",
        "New Student",
        "email",
        "general",
        "New issue",
        "New note",
        "urgent",
        1,
        "2026-07-20 10:00:00",
        "call-1",
      ],
    );
    const updatedFields = [
      "phoneNumber",
      "studentTc",
      "studentName",
      "interactionType",
      "category",
      "issue",
      "initialNote",
      "priority",
      "needsFollowUp",
      "followUpAt",
    ];
    expect(harness.repositoryMocks.writeCallEvent).toHaveBeenCalledWith(
      expect.anything(),
      "call-1",
      "call.updated",
      expect.any(String),
      { updatedFields },
    );
    expect(harness.auditWriter).toHaveBeenCalledWith(expect.objectContaining({
      action: "call.update",
      entityId: "call-1",
      metadata: {
        recordNumber: "CAG-20260713-090807-ABCDEF",
        updatedFields,
      },
    }));
    expect(harness.notificationPublisher).toHaveBeenCalledWith(
      ["calls.view.all", "calls.resolve"],
      expect.objectContaining({
        type: "call.urgent",
        entityId: "call-1",
        dedupeKey: "urgent-call:call-1",
      }),
    );
    expect(response.json).toHaveBeenCalledWith({
      call: expect.objectContaining({
        phoneNumber: "05551112233",
        priority: "urgent",
        needsFollowUp: true,
      }),
    });
  });

  it("keeps existing values, records no changed fields and returns null if reload fails", async () => {
    const harness = createControllerHarness();
    const original = createCallRow({ opened_by_user_id: "user-1" });
    harness.repositoryMocks.getCallById
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    const response = createControllerResponse();

    await harness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      body: {},
      permissions: ["calls.view.own"],
    }), response);

    expect(harness.query.mock.calls[0]![1]).toStrictEqual([
      original.phone_number,
      original.student_tc,
      original.student_name,
      original.interaction_type,
      original.category,
      original.issue,
      original.initial_note,
      original.priority,
      0,
      original.follow_up_at,
      original.id,
    ]);
    expect(harness.repositoryMocks.writeCallEvent.mock.calls[0]![4]).toStrictEqual({
      updatedFields: [],
    });
    expect(harness.notificationPublisher).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ call: null });
  });

  it("clears follow-up date when explicitly disabling follow-up", async () => {
    const harness = createControllerHarness();
    const original = createCallRow({
      opened_by_user_id: "user-1",
      needs_follow_up: 1,
      follow_up_at: "2026-07-20 10:00:00",
    });
    harness.repositoryMocks.getCallById
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(original);
    const response = createControllerResponse();

    await harness.controller.updateCall(createControllerRequest({
      params: { id: "call-1" },
      body: { needsFollowUp: false, followUpAt: "ignored" },
      permissions: ["calls.view.own"],
    }), response);

    expect(harness.query.mock.calls[0]![1]![8]).toBe(0);
    expect(harness.query.mock.calls[0]![1]![9]).toBeNull();
    expect(harness.repositoryMocks.writeCallEvent.mock.calls[0]![4]).toStrictEqual({
      updatedFields: ["needsFollowUp", "followUpAt"],
    });
  });
});

describe("call controller notes", () => {
  it("rejects locked calls, empty content and users without note permission", async () => {
    const lockedHarness = createControllerHarness();
    lockedHarness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      opened_by_user_id: "user-1",
      is_locked: 1,
    }));
    const lockedResponse = createControllerResponse();
    await lockedHarness.controller.addNote(createControllerRequest({
      params: { id: "call-1" },
      body: { content: "Note" },
      permissions: ["calls.view.own"],
    }), lockedResponse);
    expectControllerResponse(lockedResponse, 400, { message: "Kilitli kayda not eklenemez." });

    const contentHarness = createControllerHarness();
    const contentResponse = createControllerResponse();
    await contentHarness.controller.addNote(createControllerRequest({
      params: { id: "call-1" },
      body: { content: " " },
      permissions: ["calls.note.own"],
    }), contentResponse);
    expectControllerResponse(contentResponse, 400, { message: "Not içeriği zorunludur." });

    const permissionHarness = createControllerHarness();
    permissionHarness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      opened_by_user_id: "other-owner",
      assigned_to_user_id: "user-1",
    }));
    const permissionResponse = createControllerResponse();
    await permissionHarness.controller.addNote(createControllerRequest({
      params: { id: "call-1" },
      body: { content: "Note" },
    }), permissionResponse);
    expectControllerResponse(permissionResponse, 403, {
      message: "Bu kayda not ekleme yetkiniz yok.",
    });
  });

  it("rejects assigned-personnel notes from a non-assignee non-manager", async () => {
    const harness = createControllerHarness();
    harness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      opened_by_user_id: "user-1",
      assigned_to_user_id: "other-user",
    }));
    const response = createControllerResponse();

    await harness.controller.addNote(createControllerRequest({
      params: { id: "call-1" },
      body: { content: "Note", noteType: "assigned_personnel" },
      permissions: ["calls.view.own", "calls.note.own"],
    }), response);

    expectControllerResponse(response, 403, {
      message: "Atanan personel notu için kayıt size atanmış olmalıdır.",
    });
  });

  it("falls back invalid note types to personnel and preserves write order", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.addNote(createControllerRequest({
      params: { id: "call-1" },
      body: { content: " Note ", noteType: "unknown" },
      permissions: ["calls.note.own"],
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO call_notes"),
      ["generated-id", "call-1", "user-1", "personnel", "Note"],
    );
    expect(harness.repositoryMocks.writeCallEvent).toHaveBeenCalledWith(
      expect.anything(),
      "call-1",
      "note.created",
      expect.any(String),
      { noteType: "personnel" },
    );
    expect(harness.auditWriter).toHaveBeenCalledWith(expect.objectContaining({
      action: "call.note.create",
      metadata: { noteType: "personnel" },
    }));
    expectControllerResponse(response, 201, { id: "generated-id" });
  });

  it("accepts assigned-personnel notes from the assigned user", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.addNote(createControllerRequest({
      params: { id: "call-1" },
      body: { content: "Assigned note", noteType: "assigned_personnel" },
      permissions: ["calls.note.assigned"],
    }), response);

    expect(harness.query.mock.calls[0]![1]![3]).toBe("assigned_personnel");
    expect(response.status).toHaveBeenCalledWith(201);
  });
});

describe("call controller assign, status, resolve and reopen", () => {
  it("rejects locked assign and status operations", async () => {
    const assignHarness = createControllerHarness();
    assignHarness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      opened_by_user_id: "user-1",
      is_locked: 1,
    }));
    const assignResponse = createControllerResponse();
    await assignHarness.controller.assignCall(createControllerRequest({
      params: { id: "call-1" },
      permissions: ["calls.view.own"],
    }), assignResponse);
    expectControllerResponse(assignResponse, 400, { message: "Kilitli kayıt atanamaz." });

    const statusHarness = createControllerHarness();
    statusHarness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      opened_by_user_id: "user-1",
      is_locked: 1,
    }));
    const statusResponse = createControllerResponse();
    await statusHarness.controller.updateCallStatus(createControllerRequest({
      params: { id: "call-1" },
      body: { status: "open" },
      permissions: ["calls.view.own"],
    }), statusResponse);
    expectControllerResponse(statusResponse, 400, {
      message: "Kilitli kaydın durumu değiştirilemez.",
    });
  });

  it("notifies the previous assignee when an assignment is removed", async () => {
    const harness = createControllerHarness();
    harness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      assigned_to_user_id: "agent-old",
      assigned_to_name: "Old Agent",
    }));
    const response = createControllerResponse();

    await harness.controller.assignCall(createControllerRequest({
      params: { id: "call-1" },
      body: { assignedToUserId: " " },
      userId: "manager-1",
      permissions: ["calls.view.all"],
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining("SET assigned_to_user_id = ?"),
      [null, null, null, "call-1"],
    );
    expect(harness.directNotificationPublisher).toHaveBeenCalledWith(expect.objectContaining({
      userIds: ["agent-old"],
      type: "call.unassigned",
      entityId: "call-1",
      entityLabel: "CAG-20260713-090807-ABCDEF",
    }));
    expect(harness.auditWriter).toHaveBeenCalledWith(expect.objectContaining({
      action: "call.assign",
      metadata: expect.objectContaining({
        previousAssignedToUserId: "agent-old",
        assignedToUserId: null,
      }),
    }));
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it("notifies both sides on reassignment and suppresses the acting user's own notification", async () => {
    const harness = createControllerHarness();
    harness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      assigned_to_user_id: "agent-old",
      assigned_to_name: "Old Agent",
    }));
    harness.query.mockResolvedValueOnce([[{
      id: "agent-new",
      full_name: "New Agent",
      username: "new.agent",
    }], []]);
    const response = createControllerResponse();

    await harness.controller.assignCall(createControllerRequest({
      params: { id: "call-1" },
      body: { assignedToUserId: "agent-new" },
      userId: "manager-1",
      permissions: ["calls.view.all"],
    }), response);

    expect(harness.directNotificationPublisher).toHaveBeenCalledTimes(2);
    expect(harness.directNotificationPublisher).toHaveBeenNthCalledWith(1, expect.objectContaining({
      userIds: ["agent-new"],
      type: "call.assigned",
    }));
    expect(harness.directNotificationPublisher).toHaveBeenNthCalledWith(2, expect.objectContaining({
      userIds: ["agent-old"],
      type: "call.reassigned",
    }));

    harness.directNotificationPublisher.mockClear();
    harness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      assigned_to_user_id: null,
      assigned_to_name: null,
    }));
    harness.query.mockResolvedValueOnce([[{
      id: "manager-1",
      full_name: "Manager",
      username: "manager",
    }], []]);

    await harness.controller.assignCall(createControllerRequest({
      params: { id: "call-1" },
      body: { assignedToUserId: "manager-1" },
      userId: "manager-1",
      permissions: ["calls.view.all"],
    }), createControllerResponse());

    expect(harness.directNotificationPublisher).not.toHaveBeenCalled();
  });

  it("rejects empty and resolved status selections", async () => {
    const emptyHarness = createControllerHarness();
    const emptyResponse = createControllerResponse();
    await emptyHarness.controller.updateCallStatus(createControllerRequest({
      params: { id: "call-1" },
      body: { status: "" },
    }), emptyResponse);
    expectControllerResponse(emptyResponse, 400, { message: "Geçersiz durum seçimi." });

    const resolvedHarness = createControllerHarness();
    resolvedHarness.repositoryMocks.getActiveOptionValues.mockResolvedValueOnce(["resolved"]);
    const resolvedResponse = createControllerResponse();
    await resolvedHarness.controller.updateCallStatus(createControllerRequest({
      params: { id: "call-1" },
      body: { status: "resolved" },
    }), resolvedResponse);
    expectControllerResponse(resolvedResponse, 400, { message: "Geçersiz durum seçimi." });
  });

  it("updates an allowed status with exact SQL and metadata", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.updateCallStatus(createControllerRequest({
      params: { id: "call-1" },
      body: { status: " in_progress " },
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      "UPDATE call_records SET status = ? WHERE id = ?",
      ["in_progress", "call-1"],
    );
    expect(harness.repositoryMocks.writeCallEvent.mock.calls[0]![4]).toStrictEqual({
      status: "in_progress",
    });
    expect(harness.auditWriter).toHaveBeenCalledWith(expect.objectContaining({
      action: "call.status.update",
      metadata: { status: "in_progress" },
    }));
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it.each([
    [{ resolutionDescription: "", resolutionCategory: "solved" }],
    [{ resolutionDescription: "Resolved", resolutionCategory: "" }],
  ])("requires both resolve fields", async (body) => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.resolveCall(createControllerRequest({
      params: { id: "call-1" },
      body,
    }), response);

    expectControllerResponse(response, 400, {
      message: "Çözüm açıklaması ve çözüm kategorisi zorunludur.",
    });
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("reopens a call without requiring resolved state", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.reopenCall(createControllerRequest({
      params: { id: "call-1" },
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'open'"),
      ["call-1"],
    );
    expect(harness.repositoryMocks.writeCallEvent).toHaveBeenCalledWith(
      expect.anything(),
      "call-1",
      "call.reopened",
      expect.any(String),
    );
    expect(harness.auditWriter).toHaveBeenCalledWith(expect.objectContaining({
      action: "call.reopen",
      entityId: "call-1",
    }));
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it.each([
    "updateCall",
    "addNote",
    "assignCall",
    "updateCallStatus",
    "resolveCall",
    "reopenCall",
  ] as const)("returns 404 before %s side effects", async (handlerName) => {
    const harness = createControllerHarness();
    harness.repositoryMocks.getCallById.mockResolvedValueOnce(null);
    const response = createControllerResponse();

    await harness.controller[handlerName](createControllerRequest({
      params: { id: "missing" },
    }), response);

    expectControllerResponse(response, 404, { message: "Çağrı kaydı bulunamadı." });
    expect(harness.query).not.toHaveBeenCalled();
    expect(harness.auditWriter).not.toHaveBeenCalled();
  });
});
