import { db } from "../lib/db";

async function main() {
  try {
    const res = await db.execute("SELECT id, name, email FROM users ORDER BY name ASC");
    console.log("\nRegistered Users in Database:\n");
    console.table(res.rows);
  } catch (err: any) {
    console.error("Failed to list users:", err.message || err);
  }
}

main().catch(console.error);
