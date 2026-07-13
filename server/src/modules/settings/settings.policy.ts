export type OptionType =
  | "interaction_type"
  | "issue_category"
  | "status"
  | "priority"
  | "resolution_category";

export const allowedOptionTypes = [
  "interaction_type",
  "issue_category",
  "status",
  "priority",
  "resolution_category",
] satisfies OptionType[];

export function normalizeOptionType(value: unknown) {
  const type = String(value ?? "") as OptionType;
  return allowedOptionTypes.includes(type) ? type : null;
}

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeColor(type: OptionType, value: unknown) {
  if (type !== "status" && type !== "priority") {
    return null;
  }

  const color = normalizeText(value);

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

export function createOptionValue(type: OptionType, label: string) {
  if (type === "status" || type === "priority") {
    return createSystemValue(label) || label;
  }

  return label;
}

export type PreparedFieldUpdate = {
  key: string;
  label: string;
  isActive: 0 | 1;
  isRequired: 0 | 1;
  isVisible: 0 | 1;
  isEditable: 0 | 1;
  isMasked: 0 | 1;
  sortOrder: number;
};

export type PreparedOptionUpdate = {
  id: string;
  type: OptionType;
  label: string;
  value: string;
  color: string | null;
  isActive: 0 | 1;
  sortOrder: number;
};

export type PreparedSettingsUpdate = {
  fields: PreparedFieldUpdate[];
  options: PreparedOptionUpdate[];
};

export type SettingsUpdateValidation =
  | { value: PreparedSettingsUpdate; error?: never }
  | { value?: never; error: string };

export function prepareSettingsUpdate(
  fields: unknown[],
  options: unknown[],
): SettingsUpdateValidation {
  const preparedFields: PreparedFieldUpdate[] = [];

  for (const rawField of fields) {
    const field = rawField as Record<string, unknown>;
    const key = normalizeText(field.key);
    const label = normalizeText(field.label);

    if (!key || !label) {
      return { error: "Form alanı ayarlarında geçersiz kayıt var." };
    }

    preparedFields.push({
      key,
      label,
      isActive: field.isActive === true ? 1 : 0,
      isRequired: field.isRequired === true ? 1 : 0,
      isVisible: field.isVisible === true ? 1 : 0,
      isEditable: field.isEditable === true ? 1 : 0,
      isMasked: field.isMasked === true ? 1 : 0,
      sortOrder: Number(field.sortOrder) || 0,
    });
  }

  const preparedOptions: PreparedOptionUpdate[] = [];

  for (const rawOption of options) {
    const option = rawOption as Record<string, unknown>;
    const type = normalizeOptionType(option.type);
    const label = normalizeText(option.label);
    const value = type ? normalizeText(option.value) || createOptionValue(type, label) : "";
    const color = type ? normalizeColor(type, option.color) : null;

    if (color === "") {
      return { error: "Renk değeri #RRGGBB formatında olmalıdır." };
    }

    if (!option.id || !type || label.length < 2) {
      return { error: "Seçenek ayarlarında geçersiz kayıt var." };
    }

    preparedOptions.push({
      id: String(option.id),
      type,
      label,
      value,
      color,
      isActive: option.isActive === true ? 1 : 0,
      sortOrder: Number(option.sortOrder) || 0,
    });
  }

  return {
    value: {
      fields: preparedFields,
      options: preparedOptions,
    },
  };
}
