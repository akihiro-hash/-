import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requestedLeaveMinutes } from "@/lib/time";
import { createLeaveRequest } from "@/lib/json-db";

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const startDate = String(form.get("startDate"));
  const endDate = String(form.get("endDate") || startDate);
  const unit = String(form.get("unit"));
  const halfDayPeriod = unit === "HALF_DAY" ? String(form.get("halfDayPeriod") || "AM") : null;
  const hours = Number(form.get("hours") ?? 1);
  const reason = String(form.get("reason") || "理由なし");
  const leaveType = String(form.get("leaveType") || "PAID_LEAVE");
  const days =
    unit === "FULL_DAY"
      ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
      : 1;

  try {
    const created = await createLeaveRequest({
      userId: user.id,
      leaveType,
      unit,
      halfDayPeriod: halfDayPeriod === "PM" ? "PM" : halfDayPeriod === "AM" ? "AM" : null,
      startAt: `${startDate}T00:00:00+09:00`,
      endAt: `${endDate}T23:59:59+09:00`,
      requestedMinutes: requestedLeaveMinutes(unit, hours) * days,
      reason
    });
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "申請できませんでした。" }, { status: 400 });
  }
}
