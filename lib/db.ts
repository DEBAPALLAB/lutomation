import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;

if (!url) {
  if (process.env.VERCEL === "1") {
    throw new Error("CRITICAL STARTUP ERROR: The TURSO_DATABASE_URL environment variable is missing on Vercel. Please add it to your Project Settings > Environment Variables.");
  }
}

const dbUrl = url || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const globalForDb = global as unknown as { db: ReturnType<typeof createClient> };

export const db = globalForDb.db || createClient({ url: dbUrl, authToken });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
