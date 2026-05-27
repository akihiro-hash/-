import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createStaff } from "@/lib/json-db";

export async function POST(request: Request) {
  await requireAdmin();
  const form = await request.formData();
  try {
    await createStaff({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      department: String(form.get("department") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? "その他"),
      hireDate: String(form.get("hireDate") ?? ""),
      weeklyWorkDays: Number(form.get("weeklyWorkDays") ?? 5),
      weeklyWorkHours: Number(form.get("weeklyWorkHours") ?? 40)
    });
    return NextResponse.redirect(new URL("/admin?saved=staff-added", request.url), 303);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "スタッフを追加できませんでした。" }, { status: 400 });
  }
}
