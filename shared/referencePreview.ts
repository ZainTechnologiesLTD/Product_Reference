/** Provisional reference for UI only — not guaranteed unique until server create. */
export function previewReferenceCode(category: string): string {
  const trimmed = category.trim();
  const prefix = trimmed.slice(0, 2).toUpperCase().padEnd(2, "X");
  const digits = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${digits}`;
}
