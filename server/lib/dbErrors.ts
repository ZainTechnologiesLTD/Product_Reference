/** mysql2 / Drizzle duplicate key */
export function isMysqlUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; errno?: number };
  return e.code === "ER_DUP_ENTRY" || e.errno === 1062;
}

/** Heuristic: duplicate `reference` vs other unique indexes (e.g. nameNormalized). */
export function isReferenceCollisionError(err: unknown): boolean {
  if (!isMysqlUniqueViolation(err)) return false;
  const msg = `${(err as Error).message ?? ""}`.toLowerCase();
  return msg.includes("reference") || msg.includes("idx_products_reference");
}
