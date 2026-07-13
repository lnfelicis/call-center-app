import { describe, expect, it } from "vitest";
import {
  hasAnyPermission,
  hasPermission,
} from "../../../src/modules/auth/authorization-policy.js";

describe("authorization policy", () => {
  const user = { permissions: ["users.manage", "logs.view"] };

  it("requires an exact permission match", () => {
    expect(hasPermission(user, "users.manage")).toBe(true);
    expect(hasPermission(user, "users")).toBe(false);
    expect(hasPermission(undefined, "users.manage")).toBe(false);
  });

  it("keeps OR semantics for any-permission checks", () => {
    expect(hasAnyPermission(user, ["reports.view", "logs.view"])).toBe(true);
    expect(hasAnyPermission(user, ["reports.view", "reports.export"])).toBe(false);
    expect(hasAnyPermission(undefined, ["logs.view"])).toBe(false);
    expect(hasAnyPermission(user, [])).toBe(false);
  });
});
