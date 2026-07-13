import { describe, expect, it } from "vitest";
import {
  createReportOptionLabelMap,
  mapCategories,
  mapFilterOptions,
  mapStaff,
  mapSummary,
  serializeSearchRow,
} from "../../../src/modules/reports/mapper.js";
import type {
  BreakdownRow,
  CategoryRow,
  ReportFilterOptionRow,
  StaffRow,
  SummaryRow,
} from "../../../src/modules/reports/types.js";
import { createCallSearchRow, createReportUser } from "./report-fixtures.js";

describe("report mappers", () => {
  it("serializes and masks a search row with the exact response key order", () => {
    const result = serializeSearchRow(createReportUser([]), createCallSearchRow());

    expect(result).toStrictEqual({
      id: "call-1",
      recordNumber: "CALL-2026-0001",
      phoneNumber: "0555 *** ** 67",
      studentTc: "123******01",
      studentName: "Ayşe Yılmaz",
      interactionType: "incoming",
      category: "registration",
      priority: "urgent",
      status: "open",
      needsFollowUp: true,
      followUpAt: "2026-07-14T09:00:00.000Z",
      openedByUserId: "user-1",
      openedByName: "Test Operatör",
      assignedToUserId: "user-2",
      assignedToName: "Atanan Kullanıcı",
      resolvedByUserId: null,
      resolvedByName: null,
      resolvedAt: null,
      createdAt: "2026-07-13T08:30:00.000Z",
      updatedAt: "2026-07-13T08:45:00.000Z",
    });
    expect(Object.keys(result)).toStrictEqual([
      "id",
      "recordNumber",
      "phoneNumber",
      "studentTc",
      "studentName",
      "interactionType",
      "category",
      "priority",
      "status",
      "needsFollowUp",
      "followUpAt",
      "openedByUserId",
      "openedByName",
      "assignedToUserId",
      "assignedToName",
      "resolvedByUserId",
      "resolvedByName",
      "resolvedAt",
      "createdAt",
      "updatedAt",
    ]);
  });

  it("returns raw sensitive fields only with sensitive.view_unmasked", () => {
    const result = serializeSearchRow(
      createReportUser(["sensitive.view_unmasked"]),
      createCallSearchRow(),
    );

    expect(result.phoneNumber).toBe("05551234567");
    expect(result.studentTc).toBe("12345678901");
  });

  it("maps filter options and preserves fallback values", () => {
    const rows = [{
      id: "option-1",
      option_type: "issue_category",
      label: "Kayıt",
      value: null,
      color: null,
      sort_order: 4,
    }] as ReportFilterOptionRow[];

    expect(mapFilterOptions(rows)).toStrictEqual({
      options: [{
        id: "option-1",
        type: "issue_category",
        label: "Kayıt",
        value: "Kayıt",
        color: null,
        isActive: true,
        sortOrder: 4,
      }],
    });
  });

  it("keeps summary breakdown rows unchanged while coercing totals", () => {
    const summaryRows = [{
      total: "10",
      open_total: null,
      resolved_total: "6",
      follow_up_total: "2",
      urgent_total: "1",
    }] as unknown as SummaryRow[];
    const statusRows = [{ label: "open", total: 4 }] as BreakdownRow[];
    const priorityRows = [{ label: "urgent", total: 1 }] as BreakdownRow[];

    expect(mapSummary(summaryRows, statusRows, priorityRows)).toStrictEqual({
      summary: { total: 10, open: 0, resolved: 6, followUp: 2, urgent: 1 },
      byStatus: statusRows,
      byPriority: priorityRows,
    });
    expect(mapSummary([], [], []).summary).toStrictEqual({
      total: 0,
      open: 0,
      resolved: 0,
      followUp: 0,
      urgent: 0,
    });
  });

  it("maps global staff and category reports with numeric totals", () => {
    const staff = [{
      user_id: "user-1",
      full_name: "Test Operatör",
      opened_total: "8",
      resolved_total: null,
    }] as unknown as StaffRow[];
    const categories = [{
      category: "registration",
      total: "5",
      open_total: "2",
      resolved_total: null,
    }] as unknown as CategoryRow[];

    expect(mapStaff(staff)).toStrictEqual({
      staff: [{
        userId: "user-1",
        fullName: "Test Operatör",
        openedTotal: 8,
        resolvedTotal: 0,
      }],
    });
    expect(mapCategories(categories)).toStrictEqual({
      categories: [{
        category: "registration",
        total: 5,
        openTotal: 2,
        resolvedTotal: 0,
      }],
    });
  });

  it("builds status and priority labels with value-or-label keys", () => {
    const rows = [
      {
        id: "status-1",
        option_type: "status",
        label: "Açık",
        value: "open",
        color: null,
        sort_order: 1,
      },
      {
        id: "priority-1",
        option_type: "priority",
        label: "Acil",
        value: null,
        color: null,
        sort_order: 1,
      },
      {
        id: "category-1",
        option_type: "issue_category",
        label: "Kayıt",
        value: "registration",
        color: null,
        sort_order: 1,
      },
    ] as ReportFilterOptionRow[];

    const labels = createReportOptionLabelMap(rows);

    expect([...labels.status]).toStrictEqual([["open", "Açık"]]);
    expect([...labels.priority]).toStrictEqual([["Acil", "Acil"]]);
  });
});
