import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = {
    ok: true,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    database: "not_checked"
  };

  try {
    await prisma.user.count();
    status.database = "ok";
  } catch (error) {
    status.ok = false;
    status.database = error instanceof Error ? error.message : "unknown_error";
  }

  return NextResponse.json(status, { status: status.ok ? 200 : 500 });
}
