import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, createPaidLeaveGrant } from "@/lib/json-db";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const form = await request.formData();
  const workedDate = String(form.get("workedDate") ?? "");
  const grant = await createPaidLeaveGrant({
    userId: String(form.get("userId") ?? ""),
    grantDate: String(form.get("grantDate") || workedDate),
    grantedDays: Number(form.get("grantedDays") ?? 1),
    note: `休日出勤 ${workedDate} による代休付与`,
    leaveType: "SUBSTITUTE_HOLIDAY"
  });
  await createAuditLog({
    actorId: admin.id,
    action: "SUBSTITUTE_HOLIDAY_GRANT",
    entityType: "PAID_LEAVE_GRANT",
    entityId: grant.id,
    details: { userId: grant.userId, workedDate, grantDate: grant.grantDate }
  });
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
