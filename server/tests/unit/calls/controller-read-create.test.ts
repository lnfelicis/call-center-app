import { describe, expect, it } from "vitest";
import type {
  EventRow,
  NoteRow,
} from "../../../src/modules/calls/call.types.js";
import { createCallRow, createField } from "./call-fixtures.js";
import {
  createControllerHarness,
  createControllerRequest,
  createControllerResponse,
  expectControllerResponse,
} from "./controller-harness.js";

describe("call controller listing and creation", () => {
  it("lists all calls without a visibility WHERE and preserves response mapping", async () => {
    const harness = createControllerHarness();
    harness.query.mockResolvedValueOnce([[createCallRow({ needs_follow_up: 1 })], []]);
    const response = createControllerResponse();

    await harness.controller.listCalls(createControllerRequest({
      permissions: ["calls.view.all"],
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.not.stringContaining("WHERE (call_records"),
      [],
    );
    expect(response.json).toHaveBeenCalledWith({
      calls: [expect.objectContaining({
        id: "call-1",
        recordNumber: "CAG-20260713-090807-ABCDEF",
        needsFollowUp: true,
      })],
    });
  });

  it("lists own or assigned calls with duplicated user params in order", async () => {
    const harness = createControllerHarness();
    harness.query.mockResolvedValueOnce([[], []]);
    const response = createControllerResponse();

    await harness.controller.listCalls(createControllerRequest({
      permissions: ["calls.view.own"],
      userId: "agent-1",
    }), response);

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE (call_records.opened_by_user_id = ? OR call_records.assigned_to_user_id = ?)",
      ),
      ["agent-1", "agent-1"],
    );
    expect(response.json).toHaveBeenCalledWith({ calls: [] });
  });

  it("returns the configured first required-field error before duplicate queries", async () => {
    const harness = createControllerHarness();
    harness.repositoryMocks.getFieldSettings.mockResolvedValueOnce([
      createField("phoneNumber", { label: "Telefon", is_required: 1 }),
    ]);
    const response = createControllerResponse();

    await harness.controller.createCall(createControllerRequest({ body: {} }), response);

    expectControllerResponse(response, 400, { message: "Telefon zorunludur." });
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("rejects invalid phone, identity and missing follow-up date in validation order", async () => {
    const phoneHarness = createControllerHarness();
    const phoneResponse = createControllerResponse();
    await phoneHarness.controller.createCall(createControllerRequest({
      body: { phoneNumber: "123" },
    }), phoneResponse);
    expectControllerResponse(phoneResponse, 400, {
      message: "Telefon numarası formatı geçerli değil.",
    });

    const tcHarness = createControllerHarness();
    const tcResponse = createControllerResponse();
    await tcHarness.controller.createCall(createControllerRequest({
      body: { phoneNumber: "05551234567", studentTc: "10000000145" },
    }), tcResponse);
    expectControllerResponse(tcResponse, 400, { message: "Geçerli bir TC Kimlik No girin." });

    const followUpHarness = createControllerHarness();
    const followUpResponse = createControllerResponse();
    await followUpHarness.controller.createCall(createControllerRequest({
      body: { needsFollowUp: true, followUpAt: " " },
    }), followUpResponse);
    expectControllerResponse(followUpResponse, 400, {
      message: "Takip gerekiyorsa takip tarihi zorunludur.",
    });
  });

  it("returns both duplicate warnings and a null call while keeping query params", async () => {
    const harness = createControllerHarness();
    harness.query
      .mockResolvedValueOnce([[{ id: "recent" }], []])
      .mockResolvedValueOnce([[{ id: "open" }], []])
      .mockResolvedValueOnce([{}, []]);
    harness.repositoryMocks.getCallById.mockResolvedValueOnce(null);
    const response = createControllerResponse();

    await harness.controller.createCall(createControllerRequest({
      body: {
        phoneNumber: "05551234567",
        studentTc: "10000000146",
        interactionType: "phone",
        category: "registration",
        issue: "Issue",
        priority: "normal",
        needsFollowUp: "false",
      },
    }), response);

    expect(harness.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("created_at >= DATE_SUB"),
      ["05551234567"],
    );
    expect(harness.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("status NOT IN"),
      ["10000000146"],
    );
    expect(harness.query.mock.calls[2]![1]).toStrictEqual([
      "generated-id",
      "CAG-20260713-090807-GENERA",
      "05551234567",
      "10000000146",
      null,
      "phone",
      "registration",
      null,
      "Issue",
      null,
      "normal",
      0,
      null,
      "user-1",
      null,
      "127.0.0.1",
      "unit-agent",
    ]);
    expectControllerResponse(response, 201, {
      call: null,
      warnings: [
        "Aynı telefon numarasıyla son 7 gün içinde kayıt var.",
        "Aynı TC ile açık kayıt var.",
      ],
    });
    expect(harness.notificationPublisher).not.toHaveBeenCalled();
  });

  it("allows omitted optional phone and identity without running duplicate queries", async () => {
    const harness = createControllerHarness();
    harness.query.mockResolvedValueOnce([{}, []]);
    const response = createControllerResponse();

    await harness.controller.createCall(createControllerRequest({
      body: {
        interactionType: "phone",
        category: "general",
        issue: "Issue",
      },
      userAgent: null,
    }), response);

    expect(harness.query).toHaveBeenCalledOnce();
    expect(harness.query.mock.calls[0]![1]).toEqual(expect.arrayContaining([
      "generated-id",
      "CAG-20260713-090807-GENERA",
      "phone",
      "general",
      "Issue",
    ]));
    expect(harness.query.mock.calls[0]![1]!.at(-1)).toBeNull();
    expect(response.status).toHaveBeenCalledWith(201);
  });
});

describe("call controller matching and detail", () => {
  it("prefers a combined phone-and-identity match with exact params", async () => {
    const harness = createControllerHarness();
    const match = createCallRow({ opened_by_user_id: "user-1" });
    harness.query.mockResolvedValueOnce([[match], []]);
    const response = createControllerResponse();

    await harness.controller.matchCalls(createControllerRequest({
      query: { phoneNumber: "+90 (555) 123-45-67", studentTc: "10000000146" },
      permissions: ["calls.view.all"],
    }), response);

    expect(harness.query).toHaveBeenCalledOnce();
    expect(harness.query.mock.calls[0]![1]).toStrictEqual([
      "905551234567",
      "5551234567",
      "10000000146",
    ]);
    expect(response.json).toHaveBeenCalledWith({
      matches: [expect.objectContaining({ id: "call-1" })],
      matchedBy: "phone-and-tc",
    });
  });

  it("falls back from an empty combined match to identity match", async () => {
    const harness = createControllerHarness();
    harness.query
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[createCallRow()], []]);
    const response = createControllerResponse();

    await harness.controller.matchCalls(createControllerRequest({
      query: { phoneNumber: "05551234567", studentTc: "10000000146" },
      permissions: ["calls.view.all"],
    }), response);

    expect(harness.query).toHaveBeenCalledTimes(2);
    expect(harness.query.mock.calls[1]![1]).toStrictEqual(["10000000146"]);
    expect(response.json).toHaveBeenCalledWith({
      matches: [expect.objectContaining({ id: "call-1" })],
      matchedBy: "tc",
    });
  });

  it("falls through combined and identity queries to a scoped phone match", async () => {
    const harness = createControllerHarness();
    harness.query
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[createCallRow()], []]);
    const response = createControllerResponse();

    await harness.controller.matchCalls(createControllerRequest({
      query: { phoneNumber: "05551234567", studentTc: "10000000146" },
      permissions: ["calls.view.own"],
      userId: "agent-1",
    }), response);

    expect(harness.query).toHaveBeenCalledTimes(3);
    expect(harness.query.mock.calls[2]![1]).toStrictEqual([
      "05551234567",
      "5551234567",
      "agent-1",
      "agent-1",
    ]);
    expect(response.json).toHaveBeenCalledWith({
      matches: [expect.objectContaining({ id: "call-1" })],
      matchedBy: "phone",
    });
  });

  it("returns no matches without querying for short filters", async () => {
    const harness = createControllerHarness();
    const response = createControllerResponse();

    await harness.controller.matchCalls(createControllerRequest({
      query: { phoneNumber: "123", studentTc: "123" },
    }), response);

    expect(harness.query).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ matches: [], matchedBy: null });
  });

  it("returns exact 404 and 403 detail responses", async () => {
    const missingHarness = createControllerHarness();
    missingHarness.repositoryMocks.getCallById.mockResolvedValueOnce(null);
    const missingResponse = createControllerResponse();
    await missingHarness.controller.getCall(createControllerRequest({
      params: { id: "missing" },
    }), missingResponse);
    expectControllerResponse(missingResponse, 404, { message: "Çağrı kaydı bulunamadı." });

    const forbiddenHarness = createControllerHarness();
    forbiddenHarness.repositoryMocks.getCallById.mockResolvedValueOnce(createCallRow({
      opened_by_user_id: "owner-2",
      assigned_to_user_id: "assigned-2",
    }));
    const forbiddenResponse = createControllerResponse();
    await forbiddenHarness.controller.getCall(createControllerRequest({
      params: { id: "call-1" },
      userId: "other-user",
    }), forbiddenResponse);
    expectControllerResponse(forbiddenResponse, 403, {
      message: "Bu çağrı kaydını görüntüleme yetkiniz yok.",
    });
  });

  it("serializes detail notes and events in exact response key order", async () => {
    const harness = createControllerHarness();
    const note = {
      id: "note-1",
      call_id: "call-1",
      author_user_id: "user-1",
      author_name: "Agent One",
      note_type: "personnel",
      content: "Note",
      created_at: "2026-07-13 10:00:00",
    } as NoteRow;
    const event = {
      id: "event-1",
      call_id: "call-1",
      actor_user_id: null,
      actor_name: null,
      event_type: "call.created",
      description: "Created",
      metadata: { source: "unit" },
      created_at: "2026-07-13 09:00:00",
    } as EventRow;
    harness.query
      .mockResolvedValueOnce([[note], []])
      .mockResolvedValueOnce([[event], []]);
    const response = createControllerResponse();

    await harness.controller.getCall(createControllerRequest({
      params: { id: "call-1" },
      permissions: ["calls.view.own"],
    }), response);

    const body = response.json.mock.calls[0]![0] as {
      call: unknown;
      notes: unknown;
      events: unknown;
    };
    expect(Object.keys(body)).toStrictEqual(["call", "notes", "events"]);
    expect(body.notes).toStrictEqual([{
      id: "note-1",
      callId: "call-1",
      authorUserId: "user-1",
      authorName: "Agent One",
      noteType: "personnel",
      content: "Note",
      createdAt: "2026-07-13 10:00:00",
    }]);
    expect(body.events).toStrictEqual([{
      id: "event-1",
      callId: "call-1",
      actorUserId: null,
      actorName: null,
      eventType: "call.created",
      description: "Created",
      metadata: { source: "unit" },
      createdAt: "2026-07-13 09:00:00",
    }]);
  });
});
