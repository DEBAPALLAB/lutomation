import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // 1. Session verification (Defense in depth)
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await db.execute("SELECT id, name, email FROM users ORDER BY name ASC");
    return NextResponse.json({ users: res.rows });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
