import { db } from "../lib/db";

async function main() {
  console.log("Adding performance indexes...");

  const queries = [
    `CREATE INDEX IF NOT EXISTS idx_lead_activity_timestamp ON lead_activity(timestamp DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_leads_last_updated ON leads(last_updated DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_leads_niche ON leads(niche);`,
    `CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at ON scrape_jobs(created_at DESC);`
  ];

  for (const q of queries) {
    try {
      console.log(`Executing: ${q}`);
      await db.execute(q);
    } catch (err) {
      console.error("Failed to execute query:", q, err);
      process.exit(1);
    }
  }

  console.log("Indexes added successfully!");
}

main().catch((err) => {
  console.error("Index error:", err);
  process.exit(1);
});
