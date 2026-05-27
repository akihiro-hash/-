import { NextResponse } from "next/server";
import { requireUser, verifyPassword } from "@/lib/auth";
import { createAuditLog, findUserPasswordHash, updateUserPassword } from "@/lib/json-db";

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "新しいパスワードは8文字以上にしてください。" }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "新しいパスワードが一致していません。" }, { status: 400 });
  }

  const storedHash = await findUserPasswordHash(user.id);
  if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
    return NextResponse.json({ error: "現在のパスワードが違います。" }, { status: 400 });
  }

  await updateUserPassword(user.id, newPassword);
  await createAuditLog({
    actorId: user.id,
    action: "PASSWORD_CHANGE",
    entityType: "USER",
    entityId: user.id,
    details: { by: "self" }
  });
  return NextResponse.json({ ok: true });
}
