import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import {
  getSessionToken,
  validateSession,
  setSessionCookie,
} from "../auth/session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: Omit<User, "hashedPassword"> | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: Omit<User, "hashedPassword"> | null = null;

  try {
    const token = getSessionToken(opts.req);
    if (token) {
      const result = await validateSession(token);
      if (result.user) {
        // Refresh cookie if session was extended
        setSessionCookie(opts.res, token, result.session.expiresAt);
        const { hashedPassword: _, ...safeUser } = result.user;
        user = safeUser;
      }
    }
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
