import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateDailyOperations } from "@/lib/json-db";

export async function POST(request: Request) {
  await requireAdmin();
  const form = await request.formData();
  const targetDate = String(form.get("targetDate") ?? "");
  await updateDailyOperations({
    userId: String(form.get("userId") ?? ""),
    targetDate,
    onCall: form.get("onCall") === "on",
    emergencyVisits: Number(form.get("emergencyVisits") ?? 0)
  });
  return NextResponse.redirect(new URL(`/admin?month=${targetDate.slice(0, 7)}`, request.url), 303);
}
