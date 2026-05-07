import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "../auth/routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { cleanExpiredSessions } from "../auth/session";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  if (process.env.NODE_ENV === "production") {
    if (await isPortAvailable(startPort)) {
      return startPort;
    }

    throw new Error(
      `Configured production port ${startPort} is already in use. Stop the conflicting process or change PORT and Caddy together.`
    );
  }

  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust reverse proxy (needed so secure cookies / req.secure work behind TLS-terminating proxy)
  app.set("trust proxy", 1);

  // Security headers
  // HSTS / COOP / Origin-Agent-Cluster require a "trustworthy" origin (HTTPS or localhost).
  // When serving over plain HTTP on a LAN IP (e.g. http://192.168.x.x:3000) these headers
  // either get ignored with warnings or, in HSTS's case, cause the browser to force-upgrade
  // asset requests to https://, which then fail with ERR_SSL_PROTOCOL_ERROR.
  const isProd = process.env.NODE_ENV === "production";
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      hsts: isProd,
      crossOriginOpenerPolicy: isProd,
      crossOriginEmbedderPolicy: isProd,
      originAgentCluster: isProd,
    })
  );

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(cookieParser());

  // Rate limiting
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/auth", authLimiter);
  app.use("/api/trpc", apiLimiter);
  app.use("/api/trpc", (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          path: req.originalUrl,
          method: req.method,
          status: res.statusCode,
          durationMs: Date.now() - start,
        },
        "tRPC request completed"
      );
    });
    next();
  });

  // Health check
  app.get("/api/health", async (_req, res) => {
    const db = await getDb();
    res.json({
      status: "ok",
      uptime: process.uptime(),
      dbConnected: db !== null,
    });
  });

  // Auth routes
  registerAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Dev vs production
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Periodic cleanup of expired sessions (every hour)
  setInterval(() => {
    cleanExpiredSessions().catch((err) =>
      logger.error(err, "Failed to clean expired sessions")
    );
  }, 60 * 60 * 1000);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
