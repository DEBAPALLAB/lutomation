import { db } from "../lib/db";

async function main() {
  console.log("Initializing database schema...");

  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        password_hash TEXT NOT NULL,
        created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS leads (
        place_id TEXT PRIMARY KEY,
        name TEXT,
        address TEXT,
        phone TEXT,
        website TEXT,
        email TEXT,
        email_source TEXT,
        niche TEXT,
        status TEXT DEFAULT 'New',
        assigned_to TEXT REFERENCES users(id),
        assigned_at TEXT,
        last_updated_by TEXT REFERENCES users(id),
        first_seen TEXT,
        last_updated TEXT,
        notes TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`,
    `CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);`,
    `CREATE TABLE IF NOT EXISTS search_cells (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        niche TEXT,
        lat REAL,
        lng REAL,
        radius_m INTEGER,
        last_searched TEXT,
        places_found INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        searched_by TEXT REFERENCES users(id),
        UNIQUE(niche, lat, lng, radius_m)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_search_cells_lookup ON search_cells(niche, lat, lng, radius_m);`,
    `CREATE TABLE IF NOT EXISTS scrape_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        niche TEXT,
        location TEXT,
        status TEXT,
        cells_total INTEGER DEFAULT 0,
        cells_done INTEGER DEFAULT 0,
        cells_failed INTEGER DEFAULT 0,
        leads_found INTEGER DEFAULT 0,
        created_at TEXT,
        completed_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS lead_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id TEXT REFERENCES leads(place_id),
        user_id TEXT REFERENCES users(id),
        action TEXT,
        from_value TEXT,
        to_value TEXT,
        timestamp TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        ip TEXT,
        success INTEGER,
        timestamp TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS geocode_cache (
        query TEXT PRIMARY KEY,
        lat REAL,
        lng REAL,
        timestamp TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS nominatim_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS overpass_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT
    );`
  ];

  for (const q of queries) {
    try {
      await db.execute(q);
    } catch (err) {
      console.error("Failed to execute query:", q, err);
      process.exit(1);
    }
  }

  console.log("Database initialized successfully!");
}

main().catch((err) => {
  console.error("Initialization error:", err);
  process.exit(1);
});
