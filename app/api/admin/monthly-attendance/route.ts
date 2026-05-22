import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { monthRange, toJstDateKey } from "@/lib/time";
import { getMonthData } from "@/lib/json-db";

export async function GET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? toJstDateKey().slice(0, 7);
  const { days } = monthRange(month);
  const { users, records: attendance, leaves } = await getMonthData(month);

  return NextResponse.json({ month, days, users, attendance, leaves });
}
