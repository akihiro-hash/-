import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCorrectionRequest } from "@/lib/json-db";

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const targetDate = String(form.get("targetDate"));
  const clockIn = String(form.get("clockIn") ?? "");
  const clockOut = String(form.get("clockOut") ?? "");
  const reason = String(form.get("reason") ?? "");

  const created = await createCorrectionRequest({
    userId: user.id,
    targetDate,
    requestedClockInAt: clockIn ? `${targetDate}T${clockIn}:00+09:00` : null,
    requestedClockOutAt: clockOut ? `${targetDate}T${clockOut}:00+09:00` : null,
    reason
  });
  return NextResponse.json(created);
}
