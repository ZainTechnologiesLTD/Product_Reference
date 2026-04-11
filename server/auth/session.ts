import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { eq, lt } from "drizzle-orm";
import type { Request, Response } from "express";
import { getDb } from "../db";
import { sessions, users, type Session, type User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

function hashToken(token: string): string {
  const encoded = new TextEncoder().encode(token);
  return encodeHexLowerCase(sha256(encoded));
}

export async function createSession(
  userId: number,
  token: string
): Promise<Session> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessionId = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });

  return { id: sessionId, userId, expiresAt, createdAt: new Date() };
}

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };

export async function validateSession(
  token: string
): Promise<SessionValidationResult> {
  const db = await getDb();
  if (!db) return { session: null, user: null };

  const sessionId = hashToken(token);

  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (rows.length === 0) return { session: null, user: null };

  const { session, user } = rows[0];

  // Expired
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  // Refresh if within the refresh window
  if (Date.now() >= session.expiresAt.getTime() - SESSION_REFRESH_MS) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiry })
      .where(eq(sessions.id, sessionId));
    session.expiresAt = newExpiry;
  }

  return { session, user };
}

export async function invalidateSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const sessionId = hashToken(token);
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function cleanExpiredSessions(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// Cookie helpers
export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

export function getSessionToken(req: Request): string | null {
  return req.cookies?.[COOKIE_NAME] ?? null;
}
