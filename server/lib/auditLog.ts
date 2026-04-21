import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";

type AuditAction = "create" | "update" | "delete";

export async function insertAuditLog(entry: {
  userId: number;
  entityType: string;
  entityId: number;
  action: AuditAction;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(auditLogs).values({
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    oldData: entry.oldData,
    newData: entry.newData,
  });
}
