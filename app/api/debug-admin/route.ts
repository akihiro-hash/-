import { NextResponse } from "next/server";
import { getMonthData, leaveSummary } from "@/lib/json-db";
import { toJstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const month = toJstDateKey().slice(0, 7);
    const data = await getMonthData(month);
    const summaries = await Promise.all(data.users.map((user) => leaveSummary(user.id)));
    return NextResponse.json({
      ok: true,
      month,
      users: data.users.length,
      records: data.records.length,
      leaves: data.leaves.length,
      summaries: summaries.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "unknown error",
        stack: error instanceof Error ? error.stack : null
      },
      { status: 500 }
    );
  }
}
