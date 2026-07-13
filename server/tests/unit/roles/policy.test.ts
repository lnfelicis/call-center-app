import { describe, expect, it } from "vitest";
import {
  coerceRoleIsActive,
  normalizePermissionIds,
} from "../../../src/modules/roles/policy.js";

describe("role input policy", () => {
  it("normalizes only arrays and preserves duplicates and order", () => {
    expect(normalizePermissionIds("roles.manage")).toStrictEqual([]);
    expect(normalizePermissionIds(["roles.manage", 7, "", null, "roles.manage"])).toStrictEqual([
      "roles.manage",
      "7",
      "null",
      "roles.manage",
    ]);
  });

  it("preserves JavaScript Boolean coercion for isActive", () => {
    expect(coerceRoleIsActive(false)).toBe(false);
    expect(coerceRoleIsActive(0)).toBe(false);
    expect(coerceRoleIsActive("false")).toBe(true);
    expect(coerceRoleIsActive("0")).toBe(true);
  });
});
