import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateStaffSettings } from "@/lib/json-db";

export async function POST(request: Request) {
  await requireAdmin();
  const form = await request.formData();
  await updateStaffSettings({
    userId: String(form.get("userId") ?? ""),
    effectiveFrom: String(form.get("effectiveFrom") ?? ""),
    weeklyWorkDays: Number(form.get("weeklyWorkDays") ?? 5),
    weeklyWorkHours: Number(form.get("weeklyWorkHours") ?? 40),
    department: String(form.get("department") ?? ""),
    jobTitle: String(form.get("jobTitle") ?? "その他")
  });
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
