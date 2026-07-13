import { describe, expect, it } from "vitest";
import {
  buildSearchQuery,
  maskPhone,
  maskTc,
  normalizeDate,
  normalizePhone,
  normalizeText,
} from "../../../src/modules/reports/policy.js";
import { createReportUser } from "./report-fixtures.js";

describe("report policy", () => {
  it("normalizes report filter values with the legacy coercion rules", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText("  açık  ")).toBe("açık");
    expect(normalizePhone(" +90 (555) 12-34 ")).toBe("905551234");
    expect(normalizeDate("2026-07-13")).toBe("2026-07-13");
    expect(normalizeDate("13.07.2026")).toBe("");
    expect(normalizeDate("2026-7-3")).toBe("");
  });

  it("keeps the report-specific masking behavior", () => {
    expect(maskPhone("12345")).toBe("***");
    expect(maskPhone("05551234567")).toBe("0555 *** ** 67");
    expect(maskTc(null)).toBeNull();
    expect(maskTc("12345678901")).toBe("123******01");
  });

  it("scopes own viewers to opened or assigned calls before filter params", () => {
    const user = createReportUser(["calls.view.own"]);

    expect(buildSearchQuery({
      phoneNumber: "+90 (555) 12-34",
      openedByUserId: "ignored-for-scoped-user",
      category: "all",
      status: "open",
      dateFrom: "2026-07-01",
      dateTo: "invalid",
      slaStatus: "active",
    }, user)).toStrictEqual({
      params: [
        "user-1",
        "user-1",
        "%905551234%",
        "open",
        "2026-07-01",
      ],
      whereClause: "WHERE (call_records.opened_by_user_id = ? OR call_records.assigned_to_user_id = ?) AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(call_records.phone_number, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') LIKE ? AND call_records.status = ? AND DATE(call_records.created_at) >= ? AND call_records.status NOT IN ('resolved', 'closed', 'archived', 'cancelled')",
    });
  });

  it("always scopes a non-all viewer to assigned calls even without own permission", () => {
    expect(buildSearchQuery({}, createReportUser([]))).toStrictEqual({
      params: ["user-1"],
      whereClause: "WHERE (call_records.assigned_to_user_id = ?)",
    });
  });

  it("allows all-view users to apply staff filters in the legacy param order", () => {
    const user = createReportUser(["calls.view.all"]);

    expect(buildSearchQuery({
      studentTc: " 123 ",
      studentName: " Ayşe ",
      recordNumber: " REC ",
      category: "registration",
      status: "all",
      priority: "urgent",
      openedByUserId: "opened-1",
      assignedToUserId: "assigned-1",
      resolvedByUserId: "resolved-1",
      dateTo: "2026-07-31",
      followUpFrom: "2026-07-10",
      followUpTo: "2026-07-20",
      slaStatus: "overdue",
    }, user)).toStrictEqual({
      params: [
        "%123%",
        "%Ayşe%",
        "%REC%",
        "registration",
        "urgent",
        "opened-1",
        "assigned-1",
        "resolved-1",
        "2026-07-31",
        "2026-07-10",
        "2026-07-20",
      ],
      whereClause: "WHERE call_records.student_tc LIKE ? AND call_records.student_name LIKE ? AND call_records.record_number LIKE ? AND call_records.category = ? AND call_records.priority = ? AND call_records.opened_by_user_id = ? AND call_records.assigned_to_user_id = ? AND call_records.resolved_by_user_id = ? AND DATE(call_records.created_at) <= ? AND DATE(call_records.follow_up_at) >= ? AND DATE(call_records.follow_up_at) <= ? AND call_records.follow_up_at IS NOT NULL AND call_records.follow_up_at < NOW() AND call_records.status NOT IN ('resolved', 'closed', 'archived', 'cancelled')",
    });
  });

  it.each([
    ["resolved", "call_records.status IN ('resolved', 'closed')"],
    ["active", "call_records.status NOT IN ('resolved', 'closed', 'archived', 'cancelled')"],
    ["unknown", ""],
  ])("preserves the %s SLA branch", (slaStatus, condition) => {
    const result = buildSearchQuery(
      { slaStatus },
      createReportUser(["calls.view.all"]),
    );

    expect(result.params).toStrictEqual([]);
    expect(result.whereClause).toBe(condition ? `WHERE ${condition}` : "");
  });
});
