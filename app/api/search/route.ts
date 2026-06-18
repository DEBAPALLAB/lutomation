import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { geocode, queryOverpass } from "@/lib/osm";
import { generateGridCells } from "@/lib/grid";
import { getNicheTags } from "@/lib/niche-mapping";
import { enrichLeadEmail } from "@/lib/enrichment";
import { MAX_CELLS_PER_SEARCH } from "@/lib/config";
import { after } from "next/server";

export const runtime = "nodejs";

function getAddress(tags: any): string {
  if (tags["addr:full"]) return tags["addr:full"];
  const parts: string[] = [];
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  if (tags["addr:city"]) parts.push(tags["addr:city"]);
  if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);
  return parts.join(", ") || "";
}

export async function POST(req: NextRequest) {
  // 1. Session verification (Defense in depth)
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await req.json();
    const { niche, location } = body;
    const radiusM = body.radiusM ? parseInt(body.radiusM) : 5000;

    if (!niche || !location) {
      return NextResponse.json({ error: "Missing niche or location" }, { status: 400 });
    }

    const jobId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const now = new Date().toISOString();

    // Insert queued job
    await db.execute({
      sql: `INSERT INTO scrape_jobs (id, user_id, niche, location, status, cells_total, cells_done, cells_failed, leads_found, created_at)
            VALUES (?, ?, ?, ?, 'queued', 0, 0, 0, 0, ?)`,
      args: [jobId, userId, niche, location, now],
    });

    // Run scraping in the background
    const processJob = async () => {
      try {
        console.log(`[Job ${jobId}] Starting geocoding...`);
        const coords = await geocode(location);
        if (!coords) {
          console.error(`[Job ${jobId}] Geocoding failed for: ${location}`);
          await db.execute({
            sql: "UPDATE scrape_jobs SET status = 'failed', completed_at = ? WHERE id = ?",
            args: [new Date().toISOString(), jobId],
          });
          return;
        }

        const { lat, lng } = coords;
        const { tags, isBestEffort } = getNicheTags(niche);
        const allCells = generateGridCells(lat, lng, radiusM);
        const cellsToSearch = allCells.slice(0, MAX_CELLS_PER_SEARCH);

        console.log(`[Job ${jobId}] Geocoded to (${lat}, ${lng}). Generated ${allCells.length} cells. Searching first ${cellsToSearch.length}.`);

        await db.execute({
          sql: "UPDATE scrape_jobs SET status = 'running', cells_total = ? WHERE id = ?",
          args: [cellsToSearch.length, jobId],
        });

        let cellsDone = 0;
        let cellsFailed = 0;
        let totalLeadsFound = 0;

        for (const cell of cellsToSearch) {
          const cellLat = parseFloat(cell.lat.toFixed(5));
          const cellLng = parseFloat(cell.lng.toFixed(5));
          const cellRadius = cell.radiusM;

          console.log(`[Job ${jobId}] Processing cell (${cellLat}, ${cellLng}) r=${cellRadius}...`);

          // Check cell cache (freshness limit is 30 days)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const cachedCell = await db.execute({
            sql: `SELECT * FROM search_cells 
                  WHERE niche = ? AND lat = ? AND lng = ? AND radius_m = ?`,
            args: [niche.toLowerCase(), cellLat, cellLng, cellRadius],
          });

          let elements: any[] | null = null;
          let isCachedFresh = false;

          if (cachedCell.rows.length > 0) {
            const row = cachedCell.rows[0];
            if (row.status === "done" && row.last_searched && row.last_searched > thirtyDaysAgo) {
              isCachedFresh = true;
              console.log(`[Job ${jobId}] Cell is fresh in cache. Skipping Overpass query.`);
              cellsDone++;
              // Load leads already found in this area if we want, but since they are in DB we just mark cell done.
              await db.execute({
                sql: `UPDATE scrape_jobs 
                      SET cells_done = ?, cells_failed = ? 
                      WHERE id = ?`,
                args: [cellsDone, cellsFailed, jobId],
              });
              continue;
            }
          }

          // Fetch from Overpass
          elements = await queryOverpass(cellLat, cellLng, cellRadius, tags);

          if (elements === null) {
            console.error(`[Job ${jobId}] All Overpass mirrors failed for cell (${cellLat}, ${cellLng})`);
            cellsFailed++;

            // Upsert cell with failed status
            if (cachedCell.rows.length > 0) {
              await db.execute({
                sql: `UPDATE search_cells 
                      SET status = 'failed_rate_limited', searched_by = ? 
                      WHERE niche = ? AND lat = ? AND lng = ? AND radius_m = ?`,
                args: [userId, niche.toLowerCase(), cellLat, cellLng, cellRadius],
              });
            } else {
              await db.execute({
                sql: `INSERT INTO search_cells (niche, lat, lng, radius_m, status, searched_by) 
                      VALUES (?, ?, ?, ?, 'failed_rate_limited', ?)`,
                args: [niche.toLowerCase(), cellLat, cellLng, cellRadius, userId],
              });
            }

            await db.execute({
              sql: `UPDATE scrape_jobs 
                    SET cells_done = ?, cells_failed = ? 
                    WHERE id = ?`,
              args: [cellsDone, cellsFailed, jobId],
            });
            continue;
          }

          console.log(`[Job ${jobId}] Found ${elements.length} elements in cell.`);
          let cellLeadsCount = 0;

          for (const el of elements) {
            const placeId = `${el.type}/${el.id}`;
            const name = el.tags?.name || "Unnamed Business";
            const address = getAddress(el.tags || {});
            const phone = el.tags?.phone || el.tags?.["contact:phone"] || "";
            const website = el.tags?.website || el.tags?.["contact:website"] || el.tags?.url || "";
            const email = el.tags?.email || el.tags?.["contact:email"] || "";

            // Check if lead already exists
            const existingLead = await db.execute({
              sql: "SELECT website, email FROM leads WHERE place_id = ?",
              args: [placeId],
            });

            const dbNow = new Date().toISOString();
            if (existingLead.rows.length === 0) {
              // Create new lead
              await db.execute({
                sql: `INSERT INTO leads (place_id, name, address, phone, website, email, email_source, niche, status, first_seen, last_updated)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?)`,
                args: [
                  placeId,
                  name,
                  address,
                  phone,
                  website,
                  email,
                  email ? "mailto" : null,
                  niche.toLowerCase(),
                  dbNow,
                  dbNow,
                ],
              });
              cellLeadsCount++;
              totalLeadsFound++;
            } else {
              // Update existing lead name, address, phone, website, email if empty
              const row = existingLead.rows[0];
              const updatedWebsite = website || (row.website as string) || "";
              const updatedEmail = email || (row.email as string) || "";
              const updatedEmailSource = email ? "mailto" : (row.email_source as string) || null;

              await db.execute({
                sql: `UPDATE leads 
                      SET name = ?, address = ?, phone = ?, website = ?, email = ?, email_source = ?, last_updated = ? 
                      WHERE place_id = ?`,
                args: [
                  name,
                  address,
                  phone,
                  updatedWebsite,
                  updatedEmail,
                  updatedEmailSource,
                  dbNow,
                  placeId,
                ],
              });
            }

            // Email enrichment: Run best-effort scraping for websites with no email
            const activeWebsite = website || (existingLead.rows[0]?.website as string);
            const activeEmail = email || (existingLead.rows[0]?.email as string);

            if (activeWebsite && !activeEmail) {
              try {
                const enriched = await enrichLeadEmail(activeWebsite);
                if (enriched) {
                  await db.execute({
                    sql: "UPDATE leads SET email = ?, email_source = ?, last_updated = ? WHERE place_id = ?",
                    args: [enriched.email, enriched.source, new Date().toISOString(), placeId],
                  });

                  await db.execute({
                    sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                          VALUES (?, ?, 'scraped_email', NULL, ?, ?)`,
                    args: [placeId, userId, enriched.email, new Date().toISOString()],
                  });
                }
              } catch (enrichErr) {
                console.error(`[Job ${jobId}] Enrichment failed for: ${activeWebsite}`, enrichErr);
              }
            }
          }

          cellsDone++;

          // Upsert cell as done
          const cacheTime = new Date().toISOString();
          if (cachedCell.rows.length > 0) {
            await db.execute({
              sql: `UPDATE search_cells 
                    SET last_searched = ?, places_found = ?, status = 'done', searched_by = ? 
                    WHERE niche = ? AND lat = ? AND lng = ? AND radius_m = ?`,
              args: [cacheTime, cellLeadsCount, userId, niche.toLowerCase(), cellLat, cellLng, cellRadius],
            });
          } else {
            await db.execute({
              sql: `INSERT INTO search_cells (niche, lat, lng, radius_m, last_searched, places_found, status, searched_by) 
                    VALUES (?, ?, ?, ?, ?, ?, 'done', ?)`,
              args: [niche.toLowerCase(), cellLat, cellLng, cellRadius, cacheTime, cellLeadsCount, userId],
            });
          }

          // Update job progress
          await db.execute({
            sql: `UPDATE scrape_jobs 
                  SET cells_done = ?, leads_found = scrape_jobs.leads_found + ? 
                  WHERE id = ?`,
            args: [cellsDone, cellLeadsCount, jobId],
          });
        }

        // Complete job
        const finalStatus = cellsFailed > 0 ? (cellsDone > 0 ? "partial" : "failed") : "done";
        await db.execute({
          sql: "UPDATE scrape_jobs SET status = ?, completed_at = ? WHERE id = ?",
          args: [finalStatus, new Date().toISOString(), jobId],
        });
        console.log(`[Job ${jobId}] Job finished with status: ${finalStatus}`);
      } catch (err: any) {
        console.error(`[Job ${jobId}] Background runner error:`, err);
        await db.execute({
          sql: "UPDATE scrape_jobs SET status = 'failed', completed_at = ? WHERE id = ?",
          args: [new Date().toISOString(), jobId],
        });
      }
    };

    after(() => {
      processJob();
    });

    return NextResponse.json({ jobId });
  } catch (err: any) {
    console.error("POST /api/search error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
