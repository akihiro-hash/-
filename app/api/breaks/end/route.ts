import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST() {
  await requireUser();
  return NextResponse.json({ error: "休憩打刻は使用しません。" }, { status: 410 });
}
