import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { saveAttendanceCorrection } from "@/lib/json-db";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const form = await request.formData();
  try {
    await saveAttendanceCorrection({
      userId: String(form.get("userId") ?? ""),
      actorId: admin.id,
      actorRole: "ADMIN",
      targetDate: String(form.get("targetDate") ?? ""),
      clockIn: String(form.get("clockIn") ?? ""),
      clockOut: String(form.get("clockOut") ?? ""),
      reason: String(form.get("reason") ?? "管理者修正")
    });
    return NextResponse.redirect(new URL(`/admin?month=${String(form.get("targetDate") ?? "").slice(0, 7)}`, request.url), 303);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "修正できませんでした。" }, { status: 400 });
  }
}
