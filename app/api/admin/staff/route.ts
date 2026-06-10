import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, createStaff, normalizeWorkingWeekdays } from "@/lib/json-db";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const form = await request.formData();
  const workingWeekdays = normalizeWorkingWeekdays(form.getAll("workingWeekdays"));
  const employmentType = String(form.get("employmentType") || "正社員");
  const payrollDetails = {
    salaryType: String(form.get("salaryType") || "NONE"),
    monthlySalary: Number(form.get("monthlySalary") || 0),
    hourlyWage: Number(form.get("hourlyWage") || 0),
    commuteType: String(form.get("commuteType") || "NONE"),
    monthlyCommuteAllowance: Number(form.get("monthlyCommuteAllowance") || 0),
    dailyCommuteAllowance: Number(form.get("dailyCommuteAllowance") || 0)
  };
  try {
    const user = await createStaff({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      department: String(form.get("department") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? "その他"),
      hireDate: String(form.get("hireDate") ?? ""),
      weeklyWorkDays: workingWeekdays.length || Number(form.get("weeklyWorkDays") ?? 5),
      weeklyWorkHours: Number(form.get("weeklyWorkHours") ?? 40)
    });
    await createAuditLog({
      actorId: admin.id,
      action: "STAFF_CREATE",
      entityType: "USER",
      entityId: user.id,
      details: { name: user.name, jobTitle: user.jobTitle, effectiveFrom: user.hireDate, employmentType, workingWeekdays, ...payrollDetails }
    });
    await createAuditLog({
      actorId: admin.id,
      action: "STAFF_SETTINGS_UPDATE",
      entityType: "USER",
      entityId: user.id,
      details: { effectiveFrom: user.hireDate, employmentStatus: "ACTIVE", employmentType, workingWeekdays, ...payrollDetails }
    });
    return NextResponse.redirect(new URL("/admin?saved=staff-added", request.url), 303);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "スタッフを追加できませんでした。" }, { status: 400 });
  }
}
