import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, updateUserPassword } from "@/lib/json-db";

const TEMP_PASSWORD = "password123";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const form = await request.formData();
  const userId = String(form.get("userId") ?? "");
  if (!userId) {
    return NextResponse.json({ error: "スタッフを選択してください。" }, { status: 400 });
  }
  await updateUserPassword(userId, TEMP_PASSWORD);
  await createAuditLog({
    actorId: admin.id,
    action: "PASSWORD_RESET",
    entityType: "USER",
    entityId: userId,
    details: { resetToDefault: true }
  });
  return NextResponse.redirect(new URL("/admin?saved=password-reset", request.url), 303);
}
