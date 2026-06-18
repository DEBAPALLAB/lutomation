import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  // 1. Session verification
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { slug } = await params;

  // Expecting exactly: [type, id, action] (e.g., ["node", "12345", "status"])
  if (!slug || slug.length !== 3) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const [type, id, action] = slug;
  const placeId = `${type}/${id}`;
  const now = new Date().toISOString();

  try {
    // Check if lead exists
    const leadCheck = await db.execute({
      sql: "SELECT name, phone, email, notes, status, assigned_to FROM leads WHERE place_id = ? LIMIT 1",
      args: [placeId],
    });

    if (leadCheck.rows.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const currentLead = leadCheck.rows[0];

    if (action === "update") {
      const body = await req.json();
      const { name, phone, email, notes } = body;

      const oldName = (currentLead.name as string) || "";
      const oldPhone = (currentLead.phone as string) || "";
      const oldEmail = (currentLead.email as string) || "";
      const oldNotes = (currentLead.notes as string) || "";

      const newName = typeof name === "string" ? name.trim() : oldName;
      const newPhone = typeof phone === "string" ? phone.trim() : oldPhone;
      const newEmail = typeof email === "string" ? email.trim() : oldEmail;
      const newNotes = typeof notes === "string" ? notes.trim() : oldNotes;

      await db.execute({
        sql: `UPDATE leads 
              SET name = ?, phone = ?, email = ?, notes = ?, last_updated_by = ?, last_updated = ? 
              WHERE place_id = ?`,
        args: [newName, newPhone, newEmail, newNotes, userId, now, placeId],
      });

      // Insert audit activity if changed
      if (newName !== oldName) {
        await db.execute({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'edit_name', ?, ?, ?)`,
          args: [placeId, userId, oldName, newName, now],
        });
      }
      if (newPhone !== oldPhone) {
        await db.execute({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'edit_phone', ?, ?, ?)`,
          args: [placeId, userId, oldPhone, newPhone, now],
        });
      }
      if (newEmail !== oldEmail) {
        await db.execute({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'edit_email', ?, ?, ?)`,
          args: [placeId, userId, oldEmail, newEmail, now],
        });
      }
      if (newNotes !== oldNotes) {
        await db.execute({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'edit_notes', ?, ?, ?)`,
          args: [placeId, userId, oldNotes, newNotes, now],
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "status") {
      const body = await req.json();
      const { status } = body;

      if (!status) {
        return NextResponse.json({ error: "Missing status" }, { status: 400 });
      }

      const oldStatus = (currentLead.status as string) || "New";

      await db.execute({
        sql: `UPDATE leads 
              SET status = ?, last_updated_by = ?, last_updated = ? 
              WHERE place_id = ?`,
        args: [status, userId, now, placeId],
      });

      await db.execute({
        sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
              VALUES (?, ?, 'status_change', ?, ?, ?)`,
        args: [placeId, userId, oldStatus, status, now],
      });

      return NextResponse.json({ success: true });
    }

    if (action === "assign") {
      const body = await req.json();
      const { assignTo } = body; // can be userId (string) or null

      const oldAssignee = (currentLead.assigned_to as string) || null;
      const targetAssignee = assignTo ? String(assignTo) : null;

      await db.execute({
        sql: `UPDATE leads 
              SET assigned_to = ?, assigned_at = ?, last_updated_by = ?, last_updated = ? 
              WHERE place_id = ?`,
        args: [targetAssignee, targetAssignee ? now : null, userId, now, placeId],
      });

      await db.execute({
        sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
              VALUES (?, ?, 'assignment', ?, ?, ?)`,
        args: [placeId, userId, oldAssignee, targetAssignee, now],
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action not supported" }, { status: 400 });
  } catch (err) {
    console.error(`POST /api/leads/${placeId}/${action} error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  // 1. Session verification
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  if (!slug || slug.length !== 3) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const [type, id, action] = slug;
  const placeId = `${type}/${id}`;

  if (action !== "activity") {
    return NextResponse.json({ error: "Action not supported" }, { status: 400 });
  }

  try {
    const res = await db.execute({
      sql: `SELECT la.*, u.name as user_name 
            FROM lead_activity la 
            LEFT JOIN users u ON la.user_id = u.id 
            WHERE la.place_id = ? 
            ORDER BY la.timestamp DESC`,
      args: [placeId],
    });

    return NextResponse.json({ activity: res.rows });
  } catch (err) {
    console.error(`GET /api/leads/${placeId}/activity error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
