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
  const filter = searchParams.get("filter"); // 'unassigned' | 'assigned_to_me' | 'no_website'

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
