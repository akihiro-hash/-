import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { saveAttendanceCorrection, updateDailyOperations } from "@/lib/json-db";

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  try {
    const targetDate = String(form.get("targetDate") ?? "");
    const result = await saveAttendanceCorrection({
      userId: user.id,
      actorId: user.id,
      actorRole: "STAFF",
      targetDate,
      clockIn: String(form.get("clockIn") ?? ""),
      clockOut: String(form.get("clockOut") ?? ""),
      reason: String(form.get("reason") || "理由なし")
    });
    await updateDailyOperations({
      userId: user.id,
      targetDate,
      onCall: form.get("onCall") === "on",
      emergencyVisits: Number(form.get("emergencyVisits") ?? 0)
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "修正できませんでした。" }, { status: 400 });
  }
}
