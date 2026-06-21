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
      sql: "SELECT name, phone, email, notes, status, assigned_to, priority, checklist, address, website, niche FROM leads WHERE place_id = ? LIMIT 1",
      args: [placeId],
    });

    if (leadCheck.rows.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const currentLead = leadCheck.rows[0];

    if (action === "update") {
      const body = await req.json();
      const { name, phone, email, notes, address, website, niche } = body;

      const oldName = (currentLead.name as string) || "";
      const oldPhone = (currentLead.phone as string) || "";
      const oldEmail = (currentLead.email as string) || "";
      const oldNotes = (currentLead.notes as string) || "";
      const oldAddress = (currentLead.address as string) || "";
      const oldWebsite = (currentLead.website as string) || "";
      const oldNiche = (currentLead.niche as string) || "";

      const newName = typeof name === "string" ? name.trim() : oldName;
      const newPhone = typeof phone === "string" ? phone.trim() : oldPhone;
      const newEmail = typeof email === "string" ? email.trim() : oldEmail;
      const newNotes = typeof notes === "string" ? notes.trim() : oldNotes;
      const newAddress = typeof address === "string" ? address.trim() : oldAddress;
      const newWebsite = typeof website === "string" ? website.trim() : oldWebsite;
      const newNiche = typeof niche === "string" ? niche.trim() : oldNiche;

      await db.execute({
        sql: `UPDATE leads 
              SET name = ?, phone = ?, email = ?, notes = ?, address = ?, website = ?, niche = ?, last_updated_by = ?, last_updated = ? 
              WHERE place_id = ?`,
        args: [newName, newPhone, newEmail, newNotes, newAddress, newWebsite, newNiche, userId, now, placeId],
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
      if (newAddress !== oldAddress) {
        await db.execute({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'edit_address', ?, ?, ?)`,
          args: [placeId, userId, oldAddress, newAddress, now],
        });
      }
      if (newWebsite !== oldWebsite) {
        await db.execute({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'edit_website', ?, ?, ?)`,
          args: [placeId, userId, oldWebsite, newWebsite, now],
        });
      }
      if (newNiche !== oldNiche) {
        await db.execute({
          sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
                VALUES (?, ?, 'edit_niche', ?, ?, ?)`,
          args: [placeId, userId, oldNiche, newNiche, now],
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

    if (action === "priority") {
      const body = await req.json();
      const { priority } = body;

      const oldPriority = Number(currentLead.priority || 0);
      const newPriority = Number(priority) ? 1 : 0;

      await db.execute({
        sql: `UPDATE leads 
              SET priority = ?, last_updated_by = ?, last_updated = ? 
              WHERE place_id = ?`,
        args: [newPriority, userId, now, placeId],
      });

      await db.execute({
        sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
              VALUES (?, ?, 'priority_change', ?, ?, ?)`,
        args: [placeId, userId, String(oldPriority), String(newPriority), now],
      });

      return NextResponse.json({ success: true, priority: newPriority });
    }

    if (action === "checklist") {
      const body = await req.json();
      const { checklist } = body; // Array or JSON string

      const newChecklist = typeof checklist === "string" ? checklist : JSON.stringify(checklist);

      await db.execute({
        sql: `UPDATE leads 
              SET checklist = ?, last_updated_by = ?, last_updated = ? 
              WHERE place_id = ?`,
        args: [newChecklist, userId, now, placeId],
      });

      await db.execute({
        sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
              VALUES (?, ?, 'checklist_change', NULL, ?, ?)`,
        args: [placeId, userId, newChecklist, now],
      });

      return NextResponse.json({ success: true });
    }

    if (action === "comment") {
      const body = await req.json();
      const { comment } = body;

      if (!comment || typeof comment !== "string" || !comment.trim()) {
        return NextResponse.json({ error: "Missing or invalid comment" }, { status: 400 });
      }

      const commentText = comment.trim();

      const res = await db.execute({
        sql: `INSERT INTO lead_comments (place_id, user_id, comment, timestamp) 
              VALUES (?, ?, ?, ?)`,
        args: [placeId, userId, commentText, now],
      });

      const commentId = Number(res.lastInsertRowid);

      await db.execute({
        sql: `INSERT INTO lead_activity (place_id, user_id, action, from_value, to_value, timestamp) 
              VALUES (?, ?, 'add_comment', NULL, ?, ?)`,
        args: [placeId, userId, commentText.length > 50 ? commentText.substring(0, 47) + "..." : commentText, now],
      });

      return NextResponse.json({ 
        success: true, 
        comment: {
          id: commentId,
          place_id: placeId,
          user_id: userId,
          comment: commentText,
          timestamp: now,
          user_name: session.user.name || "Team Member"
        }
      });
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

  try {
    if (action === "activity") {
      const res = await db.execute({
        sql: `SELECT la.*, u.name as user_name 
              FROM lead_activity la 
              LEFT JOIN users u ON la.user_id = u.id 
              WHERE la.place_id = ? 
              ORDER BY la.timestamp DESC`,
        args: [placeId],
      });

      return NextResponse.json({ activity: res.rows });
    }

    if (action === "comments") {
      const res = await db.execute({
        sql: `SELECT lc.*, u.name as user_name 
              FROM lead_comments lc 
              LEFT JOIN users u ON lc.user_id = u.id 
              WHERE lc.place_id = ? 
              ORDER BY lc.timestamp ASC`,
        args: [placeId],
      });

      return NextResponse.json({ comments: res.rows });
    }

    return NextResponse.json({ error: "Action not supported" }, { status: 400 });
  } catch (err) {
    console.error(`GET /api/leads/${placeId}/${action} error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
