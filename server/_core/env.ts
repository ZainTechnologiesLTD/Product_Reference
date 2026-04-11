import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().optional().default("3000"),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    console.error("❌ Invalid environment variables:", formatted);
  }

  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    isProduction: process.env.NODE_ENV === "production",
    port: parseInt(process.env.PORT ?? "3000", 10),
  };
}

export const ENV = validateEnv();
