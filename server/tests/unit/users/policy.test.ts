import { describe, expect, it } from "vitest";
import { parsePermissionOverrides } from "../../../src/modules/users/policy.js";

describe("user permission override policy", () => {
  it("accepts unique allow and deny entries", () => {
    expect(parsePermissionOverrides([
      { permissionId: "logs.view", effect: "deny" },
      { permissionId: "reports.view", effect: "allow" },
    ], { optional: false })).toStrictEqual({
      valid: true,
      value: [
        { permissionId: "logs.view", effect: "deny" },
        { permissionId: "reports.view", effect: "allow" },
      ],
    });
  });

  it("preserves an omitted optional field for backward compatibility", () => {
    expect(parsePermissionOverrides(undefined, { optional: true })).toStrictEqual({
      valid: true,
      value: undefined,
    });
  });

  it.each([
    [[{ permissionId: "logs.view", effect: "invalid" }]],
    [[{ permissionId: "logs.view", effect: "deny" }, { permissionId: "logs.view", effect: "deny" }]],
    [null],
  ])("rejects invalid override input %#", (input) => {
    expect(parsePermissionOverrides(input, { optional: false }).valid).toBe(false);
  });
});
