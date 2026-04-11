import { hash, verify } from "@node-rs/argon2";
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import {
  createSession,
  generateSessionToken,
  invalidateSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  validateSession,
} from "./session";
import { logger } from "../lib/logger";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(31, "Username must be at most 31 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores"),
  email: z.string().email("Invalid email address").max(320),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(255),
  name: z.string().max(255).optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export function registerAuthRoutes(app: Express): void {
  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { username, email, password, name } = parsed.data;
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable" });
        return;
      }

      // Check existing username or email
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existing.length > 0) {
        res.status(409).json({ error: "Username already taken" });
        return;
      }

      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingEmail.length > 0) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const hashedPassword = await hash(password, ARGON2_OPTIONS);

      const result = await db.insert(users).values({
        username,
        email,
        hashedPassword,
        name: name ?? null,
      });

      const userId = result[0].insertId;

      const token = generateSessionToken();
      const session = await createSession(userId, token);
      setSessionCookie(res, token, session.expiresAt);

      logger.info({ userId, username }, "User registered");
      res.status(201).json({ success: true });
    } catch (error) {
      logger.error(error, "Registration failed");
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid credentials" });
        return;
      }

      const { username, password } = parsed.data;
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable" });
        return;
      }

      const rows = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (rows.length === 0) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      const user = rows[0];
      const validPassword = await verify(user.hashedPassword, password, ARGON2_OPTIONS);

      if (!validPassword) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      const token = generateSessionToken();
      const session = await createSession(user.id, token);
      setSessionCookie(res, token, session.expiresAt);

      logger.info({ userId: user.id }, "User logged in");
      res.json({ success: true });
    } catch (error) {
      logger.error(error, "Login failed");
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const token = getSessionToken(req);
      if (token) {
        await invalidateSession(token);
      }
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (error) {
      logger.error(error, "Logout failed");
      clearSessionCookie(res);
      res.json({ success: true });
    }
  });

  // Get current user (for tRPC fallback)
  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = getSessionToken(req);
      if (!token) {
        res.json(null);
        return;
      }

      const result = await validateSession(token);
      if (!result.user) {
        clearSessionCookie(res);
        res.json(null);
        return;
      }

      const { hashedPassword: _, ...safeUser } = result.user;
      res.json(safeUser);
    } catch (error) {
      logger.error(error, "Failed to get current user");
      res.json(null);
    }
  });
}
