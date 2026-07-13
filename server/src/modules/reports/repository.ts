import type {
  BreakdownRow,
  CallSearchRow,
  CategoryRow,
  ReportDatabase,
  ReportFilterOptionRow,
  SearchQuery,
  StaffRow,
  SummaryRow,
} from "./types.js";

export type ReportRepository = ReturnType<typeof createReportRepository>;

export function createReportRepository(database: ReportDatabase) {
  return {
    async findFilterOptions() {
      const [rows] = await database.query<ReportFilterOptionRow[]>(
        `SELECT id, option_type, label, value, color, sort_order
        FROM call_form_options
        WHERE is_active = 1 AND option_type IN ('issue_category', 'status', 'priority')
        ORDER BY option_type ASC, sort_order ASC, label ASC`,
      );

      return rows;
    },

    async searchCalls(searchQuery: SearchQuery, limit: number) {
      const [rows] = await database.query<CallSearchRow[]>(
        `SELECT
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
        ${searchQuery.whereClause}
        ORDER BY call_records.created_at DESC
        LIMIT ?`,
        [...searchQuery.params, limit],
      );

      return rows;
    },

    async findSummary() {
      const [rows] = await database.query<SummaryRow[]>(
        `SELECT
          COUNT(*) AS total,
          SUM(status NOT IN ('resolved', 'closed', 'archived', 'cancelled')) AS open_total,
          SUM(status IN ('resolved', 'closed')) AS resolved_total,
          SUM(needs_follow_up = 1 AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')) AS follow_up_total,
          SUM(priority = 'urgent') AS urgent_total
        FROM call_records`,
      );

      return rows;
    },

    async findStatusBreakdown() {
      const [rows] = await database.query<BreakdownRow[]>(
        "SELECT status AS label, COUNT(*) AS total FROM call_records GROUP BY status ORDER BY total DESC",
      );

      return rows;
    },

    async findPriorityBreakdown() {
      const [rows] = await database.query<BreakdownRow[]>(
        "SELECT priority AS label, COUNT(*) AS total FROM call_records GROUP BY priority ORDER BY total DESC",
      );

      return rows;
    },

    async findStaff() {
      const [rows] = await database.query<StaffRow[]>(
        `SELECT
          users.id AS user_id,
          users.full_name,
          COUNT(call_records.id) AS opened_total,
          SUM(call_records.status IN ('resolved', 'closed')) AS resolved_total
        FROM users
        LEFT JOIN call_records ON call_records.opened_by_user_id = users.id
        GROUP BY users.id, users.full_name
        ORDER BY opened_total DESC, users.full_name ASC`,
      );

      return rows;
    },

    async findCategories() {
      const [rows] = await database.query<CategoryRow[]>(
        `SELECT
          category,
          COUNT(*) AS total,
          SUM(status NOT IN ('resolved', 'closed', 'archived', 'cancelled')) AS open_total,
          SUM(status IN ('resolved', 'closed')) AS resolved_total
        FROM call_records
        GROUP BY category
        ORDER BY total DESC`,
      );

      return rows;
    },

    async findReportOptionLabels() {
      const [rows] = await database.query<ReportFilterOptionRow[]>(
        `SELECT id, option_type, label, value, color, sort_order
        FROM call_form_options
        WHERE is_active = 1 AND option_type IN ('status', 'priority')
        ORDER BY option_type ASC, sort_order ASC, label ASC`,
      );

      return rows;
    },
  };
}
