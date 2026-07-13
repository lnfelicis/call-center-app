import { describe, expect, it, vi } from "vitest";
import { createReportRepository } from "../../../src/modules/reports/repository.js";
import type { ReportDatabase } from "../../../src/modules/reports/types.js";
import { createCallSearchRow } from "./report-fixtures.js";

const normalizeSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("report repository", () => {
  it("keeps search joins, ordering, SQL params and limit placement", async () => {
    const row = createCallSearchRow();
    const query = vi.fn().mockResolvedValue([[row], []]);
    const repository = createReportRepository({ query } as unknown as ReportDatabase);

    await expect(repository.searchCalls({
      whereClause: "WHERE call_records.status = ?",
      params: ["open"],
    }, 200)).resolves.toStrictEqual([row]);

    expect(query).toHaveBeenCalledOnce();
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(normalizeSql(sql)).toBe(normalizeSql(`SELECT
      call_records.id,
      call_records.record_number,
      call_records.phone_number,
      call_records.student_tc,
      call_records.student_name,
      call_records.interaction_type,
      call_records.category,
      call_records.priority,
      call_records.status,
      call_records.needs_follow_up,
      call_records.follow_up_at,
      call_records.opened_by_user_id,
      opened_by.full_name AS opened_by_name,
      call_records.assigned_to_user_id,
      assigned_to.full_name AS assigned_to_name,
      call_records.resolved_by_user_id,
      resolved_by.full_name AS resolved_by_name,
      call_records.resolved_at,
      call_records.created_at,
      call_records.updated_at
    FROM call_records
    INNER JOIN users opened_by ON opened_by.id = call_records.opened_by_user_id
    LEFT JOIN users assigned_to ON assigned_to.id = call_records.assigned_to_user_id
    LEFT JOIN users resolved_by ON resolved_by.id = call_records.resolved_by_user_id
    WHERE call_records.status = ?
    ORDER BY call_records.created_at DESC
    LIMIT ?`));
    expect(params).toStrictEqual(["open", 200]);
  });

  it("keeps filter and export-label queries distinct", async () => {
    const query = vi.fn().mockResolvedValue([[], []]);
    const repository = createReportRepository({ query } as unknown as ReportDatabase);

    await repository.findFilterOptions();
    await repository.findReportOptionLabels();

    const filterSql = normalizeSql(query.mock.calls[0]?.[0] as string);
    const labelSql = normalizeSql(query.mock.calls[1]?.[0] as string);
    expect(filterSql).toContain("option_type IN ('issue_category', 'status', 'priority')");
    expect(labelSql).toContain("option_type IN ('status', 'priority')");
    expect(filterSql).toContain("ORDER BY option_type ASC, sort_order ASC, label ASC");
    expect(labelSql).toContain("ORDER BY option_type ASC, sort_order ASC, label ASC");
  });

  it("uses unscoped SQL for summary, staff and category reports", async () => {
    const query = vi.fn().mockResolvedValue([[], []]);
    const repository = createReportRepository({ query } as unknown as ReportDatabase);

    await repository.findSummary();
    await repository.findStatusBreakdown();
    await repository.findPriorityBreakdown();
    await repository.findStaff();
    await repository.findCategories();

    expect(query).toHaveBeenCalledTimes(5);
    for (const [sql] of query.mock.calls) {
      expect(normalizeSql(sql as string)).not.toContain("opened_by_user_id = ?");
      expect(normalizeSql(sql as string)).not.toContain("assigned_to_user_id = ?");
    }
  });
});
