import type { PermissionOverride } from "./types.js";

export type PermissionOverrideParseResult =
  | { valid: true; value: PermissionOverride[] | undefined }
  | { valid: false; value: undefined };

export function parsePermissionOverrides(
  input: unknown,
  options: { optional: boolean },
): PermissionOverrideParseResult {
  if (input === undefined && options.optional) {
    return { valid: true, value: undefined };
  }

  if (!Array.isArray(input)) {
    return { valid: false, value: undefined };
  }

  const seen = new Set<string>();
  const value: PermissionOverride[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      return { valid: false, value: undefined };
    }

    const permissionId = String((item as { permissionId?: unknown }).permissionId ?? "").trim();
    const effect = (item as { effect?: unknown }).effect;

    if (!permissionId || (effect !== "allow" && effect !== "deny") || seen.has(permissionId)) {
      return { valid: false, value: undefined };
    }

    seen.add(permissionId);
    value.push({ permissionId, effect });
  }

  return { valid: true, value };
}
