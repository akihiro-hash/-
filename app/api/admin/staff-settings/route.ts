import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, normalizeWorkingWeekdays, updateStaffSettings } from "@/lib/json-db";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const form = await request.formData();
  const userId = String(form.get("userId") ?? "");
  await updateStaffSettings({
    userId: String(form.get("userId") ?? ""),
    effectiveFrom: String(form.get("effectiveFrom") ?? ""),
    weeklyWorkDays: Number(form.get("weeklyWorkDays") ?? 5),
    weeklyWorkHours: Number(form.get("weeklyWorkHours") ?? 40),
    standardStartTime: String(form.get("standardStartTime") ?? "09:00"),
    standardEndTime: String(form.get("standardEndTime") ?? "18:00"),
    department: String(form.get("department") ?? ""),
    jobTitle: String(form.get("jobTitle") ?? "その他"),
    employmentStatus: String(form.get("employmentStatus") ?? "ACTIVE") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    retirementDate: String(form.get("retirementDate") ?? "")
  });
  await createAuditLog({
    actorId: admin.id,
    action: "STAFF_SETTINGS_UPDATE",
    entityType: "USER",
    entityId: userId,
    details: {
      effectiveFrom: String(form.get("effectiveFrom") ?? ""),
      employmentStatus: String(form.get("employmentStatus") ?? "ACTIVE"),
      retirementDate: String(form.get("retirementDate") ?? ""),
      employmentType: String(form.get("employmentType") || "正社員"),
      salaryType: String(form.get("salaryType") || "NONE"),
      monthlySalary: Number(form.get("monthlySalary") || 0),
      hourlyWage: Number(form.get("hourlyWage") || 0),
      commuteType: String(form.get("commuteType") || "NONE"),
      monthlyCommuteAllowance: Number(form.get("monthlyCommuteAllowance") || 0),
      dailyCommuteAllowance: Number(form.get("dailyCommuteAllowance") || 0),
      workingWeekdays: normalizeWorkingWeekdays(form.getAll("workingWeekdays"))
    }
  });
  return NextResponse.redirect(new URL("/admin?saved=staff-settings", request.url), 303);
}
