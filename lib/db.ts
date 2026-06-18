import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const globalForDb = global as unknown as { db: ReturnType<typeof createClient> };

export const db = globalForDb.db || createClient({ url, authToken });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
