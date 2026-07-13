import type { CallRepository } from "./call.repository.js";
import { fieldAllowsEdit } from "./call.policy.js";
import type { CallFormFieldRow, Clock, IdGenerator } from "./call.types.js";

export function generateRecordNumber(clock: Clock, idGenerator: IdGenerator) {
  const now = clock();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toTimeString().slice(0, 8).replaceAll(":", "");
  const suffix = idGenerator().slice(0, 6).toUpperCase();

  return `CAG-${date}-${time}-${suffix}`;
}

export function normalizeOptionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizeRequiredString(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeOptionColor(type: string, value: unknown) {
  if (type !== "status" && type !== "priority") {
    return null;
  }

  const color = normalizeRequiredString(value);

  if (!color) {
    return null;
  }

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "";
}

export function createSystemValue(label: string) {
  return label
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function createOptionValue(type: string, label: string) {
  if (type === "status" || type === "priority") {
    return createSystemValue(label) || label;
  }

  return label;
}

export function normalizePhoneForMatch(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function editableOptionalValue(
  fields: CallFormFieldRow[],
  body: Record<string, unknown>,
  fieldKey: string,
  value: unknown,
  fallback: string | null,
) {
  return fieldAllowsEdit(fields, fieldKey) && Object.hasOwn(body, fieldKey)
    ? normalizeOptionalString(value)
    : fallback;
}

export async function normalizeOptionValue(
  repository: CallRepository,
  type: "priority" | "status",
  value: unknown,
  fallback: string,
) {
  const optionValue = normalizeRequiredString(value);

  if (!optionValue) {
    return fallback;
  }

  const allowedValues = await repository.getActiveOptionValues(type);
  return allowedValues.includes(optionValue) ? optionValue : fallback;
}

export function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function phoneMatchSqlExpression(columnName: string) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '')`;
}

export function buildPhoneMatchFilter(columnName: string, phoneNumber: string) {
  const expression = phoneMatchSqlExpression(columnName);
  const conditions = [`${expression} = ?`];
  const params = [phoneNumber];

  if (phoneNumber.length >= 10) {
    conditions.push(`RIGHT(${expression}, 10) = ?`);
    params.push(phoneNumber.slice(-10));
  }

  return { conditions, params };
}
