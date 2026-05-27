import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { closeAttendanceMonth } from "@/lib/json-db";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const form = await request.formData();
  const month = String(form.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "対象月が不正です。" }, { status: 400 });
  }
  await closeAttendanceMonth(month, admin.id);
  return NextResponse.redirect(new URL(`/admin?month=${month}&saved=month-closed`, request.url), 303);
}
