export const OFFICIAL_ADAPTER_LANE = 'official' as const;

export function normalizeRequiredString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new TypeError(`Expected non-empty string for "${fieldName}".`);
  }

  return normalized;
}

export function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}
