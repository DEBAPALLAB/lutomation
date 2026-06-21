import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Session verification (Defense in depth)
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const niche = searchParams.get("niche");
  const filter = searchParams.get("filter"); // 'unassigned' | 'assigned_to_me' | 'no_website' | 'assigned_to:<userId>'
  const starred = searchParams.get("starred"); // 'true' | 'false'

  try {
    let sql = `
      SELECT l.*, u.name as assignee_name, u2.name as updater_name 
      FROM leads l 
      LEFT JOIN users u ON l.assigned_to = u.id 
      LEFT JOIN users u2 ON l.last_updated_by = u2.id
    `;
    const conditions: string[] = [];
    const args: any[] = [];

    if (niche) {
      conditions.push("l.niche = ?");
      args.push(niche.toLowerCase().trim());
    }

    if (filter === "unassigned") {
      conditions.push("l.assigned_to IS NULL");
    } else if (filter === "assigned_to_me") {
      conditions.push("l.assigned_to = ?");
      args.push(userId);
    } else if (filter === "no_website") {
      conditions.push("(l.website IS NULL OR l.website = '')");
    } else if (filter && filter.startsWith("assigned_to:")) {
      const targetUserId = filter.substring("assigned_to:".length);
      conditions.push("l.assigned_to = ?");
      args.push(targetUserId);
    }

    if (starred === "true") {
      conditions.push("l.priority = 1");
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY l.last_updated DESC";

    const res = await db.execute({ sql, args });
    return NextResponse.json({ leads: res.rows });
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 1. Session verification
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date().toISOString();

  try {
    const body = await req.json();
    const { action, placeIds, value } = body;

    if (!action || !placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const batches: { sql: string; args: any[] }[] = [];

    if (action === "status") {
      const status = String(value);
      const placeholders = placeIds.map(() => "?").join(",");
      const currentLeads = await db.execute({
        sql: `SELECT place_id, status FROM leads WHERE place_id IN (${placeholders})`,
        args: placeIds
      });
      const statusMap = new Map(currentLeads.rows.map(r => [r.place_id, r.status]));

      for (const placeId of placeIds) {
        const oldStatus = statusMap.get(placeId) || "New";
        batches.push({
          sql: `UPDATE leads SET status = ?, last_updated_by = ?, last_updated = ? WHERE place_id = ?`,
          args: [status, userId, now, placeId]
        });
        batches.push({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'status_change', ?, ?, ?)`,
          args: [placeId, userId, oldStatus, status, now]
        });
      }
    } else if (action === "assign") {
      const assignTo = value ? String(value) : null;
      const placeholders = placeIds.map(() => "?").join(",");
      const currentLeads = await db.execute({
        sql: `SELECT place_id, assigned_to FROM leads WHERE place_id IN (${placeholders})`,
        args: placeIds
      });
      const assignMap = new Map(currentLeads.rows.map(r => [r.place_id, r.assigned_to]));

      for (const placeId of placeIds) {
        const oldAssign = assignMap.get(placeId) || null;
        batches.push({
          sql: `UPDATE leads SET assigned_to = ?, assigned_at = ?, last_updated_by = ?, last_updated = ? WHERE place_id = ?`,
          args: [assignTo, assignTo ? now : null, userId, now, placeId]
        });
        batches.push({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'assignment', ?, ?, ?)`,
          args: [placeId, userId, oldAssign, assignTo, now]
        });
      }
    } else if (action === "priority") {
      const priority = value ? 1 : 0;
      const placeholders = placeIds.map(() => "?").join(",");
      const currentLeads = await db.execute({
        sql: `SELECT place_id, priority FROM leads WHERE place_id IN (${placeholders})`,
        args: placeIds
      });
      const priorityMap = new Map(currentLeads.rows.map(r => [r.place_id, Number(r.priority || 0)]));

      for (const placeId of placeIds) {
        const oldPriority = priorityMap.get(placeId) || 0;
        batches.push({
          sql: `UPDATE leads SET priority = ?, last_updated_by = ?, last_updated = ? WHERE place_id = ?`,
          args: [priority, userId, now, placeId]
        });
        batches.push({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'priority_change', ?, ?, ?)`,
          args: [placeId, userId, String(oldPriority), String(priority), now]
        });
      }
    } else if (action === "delete") {
      const placeholders = placeIds.map(() => "?").join(",");
      batches.push({
        sql: `DELETE FROM lead_activity WHERE place_id IN (${placeholders})`,
        args: placeIds
      });
      batches.push({
        sql: `DELETE FROM lead_comments WHERE place_id IN (${placeholders})`,
        args: placeIds
      });
      batches.push({
        sql: `DELETE FROM leads WHERE place_id IN (${placeholders})`,
        args: placeIds
      });
    } else {
      return NextResponse.json({ error: "Action not supported" }, { status: 400 });
    }

    if (batches.length > 0) {
      await db.batch(batches, "write");
    }

    return NextResponse.json({ success: true, count: placeIds.length });
  } catch (err) {
    console.error("POST /api/leads error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
