import fs from "fs";
import path from "path";

// 1. Load env variables manually to handle Turso config
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
    console.log("Loaded environment from .env.local");
  }
} catch (e) {
  console.error("Failed to load .env.local", e);
}

async function main() {
  console.log("Running migrations on database:", process.env.TURSO_DATABASE_URL || "local.db");
  
  // Dynamically import db after env is loaded
  const { db } = await import("../lib/db");

  // 1. Add priority column to leads table
  try {
    console.log("Adding priority column to leads table...");
    await db.execute("ALTER TABLE leads ADD COLUMN priority INTEGER DEFAULT 0");
    console.log("priority column added successfully.");
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes("duplicate column name") || msg.includes("already exists")) {
      console.log("priority column already exists, skipping.");
    } else {
      console.warn("Info: priority column not added (might already exist):", msg);
    }
  }

  // 2. Add checklist column to leads table
  try {
    console.log("Adding checklist column to leads table...");
    await db.execute("ALTER TABLE leads ADD COLUMN checklist TEXT");
    console.log("checklist column added successfully.");
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes("duplicate column name") || msg.includes("already exists")) {
      console.log("checklist column already exists, skipping.");
    } else {
      console.warn("Info: checklist column not added (might already exist):", msg);
    }
  }

  // 3. Create lead_comments table
  try {
    console.log("Creating lead_comments table...");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS lead_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id TEXT REFERENCES leads(place_id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        comment TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
    console.log("lead_comments table created successfully.");
  } catch (err: any) {
    console.error("Failed to create lead_comments table:", err.message || err);
    process.exit(1);
  }

  console.log("Migrations complete!");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
