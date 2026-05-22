import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createPaidLeaveGrant } from "@/lib/json-db";

export async function POST(request: Request) {
  await requireAdmin();
  const form = await request.formData();
  const workedDate = String(form.get("workedDate") ?? "");
  await createPaidLeaveGrant({
    userId: String(form.get("userId") ?? ""),
    grantDate: String(form.get("grantDate") || workedDate),
    grantedDays: Number(form.get("grantedDays") ?? 1),
    note: `休日出勤 ${workedDate} による代休付与`,
    leaveType: "SUBSTITUTE_HOLIDAY"
  });
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
