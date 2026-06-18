import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // 1. Session verification (Defense in depth)
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  try {
    const res = await db.execute({
      sql: "SELECT * FROM scrape_jobs WHERE id = ? LIMIT 1",
      args: [jobId],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (err) {
    console.error("GET /api/jobs/[jobId] error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
