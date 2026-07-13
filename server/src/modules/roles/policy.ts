export function normalizePermissionIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).filter(Boolean);
}

export function coerceRoleIsActive(value: unknown) {
  return Boolean(value);
}
