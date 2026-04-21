/** Lowercased trimmed name for case-insensitive uniqueness per user. */
export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase();
}
