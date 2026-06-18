import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Session verification
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await db.execute(`
      SELECT 
        la.id,
        la.place_id,
        la.user_id,
        la.action,
        la.from_value,
        la.to_value,
        la.timestamp,
        u.name as user_name,
        l.name as lead_name,
        l.niche
      FROM lead_activity la
      LEFT JOIN users u ON la.user_id = u.id
      LEFT JOIN leads l ON la.place_id = l.place_id
      ORDER BY la.timestamp DESC
      LIMIT 15
    `);
    
    return NextResponse.json({ activity: res.rows });
  } catch (err) {
    console.error("GET /api/activity error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
