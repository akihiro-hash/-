import { NextResponse } from "next/server";
import { requireAdmin, setSession, verifyPassword } from "@/lib/auth";
import { createAuditLog, findUserPasswordHash, updateUserEmail, updateUserPassword } from "@/lib/json-db";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const form = await request.formData();
  const currentPassword = String(form.get("currentPassword") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const newPassword = String(form.get("newPassword") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");

  const storedHash = await findUserPasswordHash(admin.id);
  if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
    return NextResponse.json({ error: "現在のパスワードが違います。" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "メールアドレスを正しく入力してください。" }, { status: 400 });
  }

  if (newPassword || confirmPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "新しいパスワードは8文字以上にしてください。" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "新しいパスワードが一致していません。" }, { status: 400 });
    }
  }

  try {
    await updateUserEmail(admin.id, email);
    if (newPassword) {
      await updateUserPassword(admin.id, newPassword);
    }
    await createAuditLog({
      actorId: admin.id,
      action: "ADMIN_ACCOUNT_UPDATE",
      entityType: "USER",
      entityId: admin.id,
      details: { emailChanged: email !== admin.email, passwordChanged: Boolean(newPassword) }
    });
    await setSession({
      id: admin.id,
      role: "ADMIN",
      name: admin.name,
      department: admin.department,
      jobTitle: admin.jobTitle,
      weeklyWorkDays: admin.weeklyWorkDays,
      weeklyWorkHours: admin.weeklyWorkHours
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "管理者アカウントを変更できませんでした。" }, { status: 400 });
  }
}
