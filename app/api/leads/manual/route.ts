import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date().toISOString();

  try {
    const body = await req.json();
    const { name, phone, email, website, address, niche } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate a unique ID for manual leads
    const placeId = `manual_${crypto.randomUUID()}`;

    const sql = `
      INSERT INTO leads (
        place_id, name, address, phone, website, email, email_source, 
        niche, status, assigned_to, first_seen, last_updated, last_updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // Assign to creator by default
    const assignedTo = userId;

    const args = [
      placeId,
      name,
      address || null,
      phone || null,
      website || null,
      email || null,
      "manual",
      niche || "General",
      "New",
      assignedTo,
      now,
      now,
      userId
    ];

    const batches = [];
    batches.push({ sql, args });

    // Track creation
    batches.push({
      sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
            VALUES (?, ?, 'creation', NULL, 'Manual Lead Created', ?)`,
      args: [placeId, userId, now]
    });

    // Track assignment since it's auto-assigned to creator
    batches.push({
      sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
            VALUES (?, ?, 'assignment', NULL, ?, ?)`,
      args: [placeId, userId, assignedTo, now]
    });

    await db.batch(batches, "write");

    // Fetch the inserted lead to return it
    const fetchSql = `
      SELECT l.*, u.name as assignee_name, u2.name as updater_name 
      FROM leads l 
      LEFT JOIN users u ON l.assigned_to = u.id 
      LEFT JOIN users u2 ON l.last_updated_by = u2.id
      WHERE l.place_id = ?
    `;
    const insertedLeadRes = await db.execute({ sql: fetchSql, args: [placeId] });

    return NextResponse.json({ success: true, lead: insertedLeadRes.rows[0] });
  } catch (err) {
    console.error("POST /api/leads/manual error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
