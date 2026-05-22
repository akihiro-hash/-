import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createPaidLeaveGrant } from "@/lib/json-db";

export async function POST(request: Request) {
  await requireAdmin();
  const form = await request.formData();
  await createPaidLeaveGrant({
    userId: String(form.get("userId") ?? ""),
    grantDate: String(form.get("grantDate") ?? ""),
    grantedDays: Number(form.get("grantedDays") ?? 0),
    note: String(form.get("note") ?? "")
  });
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
