import { db } from "./db";
import { OVERPASS_ENDPOINTS, getUserAgent } from "./config";

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Check Geocode Cache
  try {
    const cached = await db.execute({
      sql: "SELECT * FROM geocode_cache WHERE query = ?",
      args: [normalizedQuery],
    });

    if (cached.rows.length > 0) {
      const row = cached.rows[0];
      const cachedTime = new Date(row.timestamp as string).getTime();
      const ageDays = (Date.now() - cachedTime) / (1000 * 60 * 60 * 24);
      if (ageDays < 30) {
        console.log(`Geocode cache hit for: "${normalizedQuery}" -> (${row.lat}, ${row.lng})`);
        return { lat: Number(row.lat), lng: Number(row.lng) };
      }
    }
  } catch (err) {
    console.error("Geocode cache lookup error:", err);
  }

  // 2. Enforce Nominatim spacing: min 1.1s team-wide
  try {
    const lastCall = await db.execute("SELECT timestamp FROM nominatim_calls ORDER BY id DESC LIMIT 1");
    if (lastCall.rows.length > 0) {
      const lastTime = new Date(lastCall.rows[0].timestamp as string).getTime();
      const diff = Date.now() - lastTime;
      if (diff < 1100) {
        const wait = 1100 - diff;
        console.log(`Waiting ${wait}ms to spacing Nominatim calls...`);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }

    // Insert call log immediately to reserve slot
    await db.execute({
      sql: "INSERT INTO nominatim_calls (timestamp) VALUES (?)",
      args: [new Date().toISOString()],
    });
  } catch (err) {
    console.error("Failed enforcing Nominatim spacing:", err);
  }

  // 3. Perform external fetch
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  console.log(`Calling Nominatim API for: "${query}"`);
  
  const res = await fetch(url, {
    headers: {
      "User-Agent": getUserAgent(),
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim geocoding failed: ${res.statusText}`);
  }

  const data = (await res.json()) as any[];
  if (data.length === 0) {
    return null;
  }

  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  // 4. Update Cache
  try {
    await db.execute({
      sql: "INSERT OR REPLACE INTO geocode_cache (query, lat, lng, timestamp) VALUES (?, ?, ?, ?)",
      args: [normalizedQuery, lat, lng, new Date().toISOString()],
    });
  } catch (err) {
    console.error("Failed to write geocode cache:", err);
  }

  return { lat, lng };
}

export async function queryOverpass(
  lat: number,
  lng: number,
  radiusM: number,
  tags: string[]
): Promise<any[] | null> {
  // Generate Overpass QL
  const aroundClause = `(around:${radiusM},${lat},${lng})`;
  let innerQuery = "";
  for (const tag of tags) {
    innerQuery += `  node${tag}${aroundClause};\n`;
    innerQuery += `  way${tag}${aroundClause};\n`;
    innerQuery += `  relation${tag}${aroundClause};\n`;
  }

  const query = `[out:json][timeout:25];
(
${innerQuery});
out center body;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    // 1. Enforce 1s spacing team-wide
    try {
      const lastCall = await db.execute("SELECT timestamp FROM overpass_calls ORDER BY id DESC LIMIT 1");
      if (lastCall.rows.length > 0) {
        const lastTime = new Date(lastCall.rows[0].timestamp as string).getTime();
        const diff = Date.now() - lastTime;
        if (diff < 1000) {
          const wait = 1000 - diff;
          console.log(`Waiting ${wait}ms to spacing Overpass calls...`);
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }

      await db.execute({
        sql: "INSERT INTO overpass_calls (timestamp) VALUES (?)",
        args: [new Date().toISOString()],
      });
    } catch (err) {
      console.error("Failed enforcing Overpass spacing:", err);
    }

    // 2. Query endpoint
    console.log(`Querying Overpass mirror: ${endpoint}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": getUserAgent(),
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.warn(`Overpass rate-limit (429) from ${endpoint}. Retrying next mirror after 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      if (!res.ok) {
        console.warn(`Overpass HTTP error ${res.status} from ${endpoint}. Retrying next mirror after 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      const data = (await res.json()) as { elements?: any[] };
      return data.elements || [];
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(`Overpass request failed on ${endpoint}:`, err.message || err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
  }

  // All endpoints failed
  return null;
}
