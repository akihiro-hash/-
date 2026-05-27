import { NextResponse } from "next/server";
import { setSession, verifyPassword } from "@/lib/auth";
import { findLoginUserByEmail } from "@/lib/json-db";

export async function GET(request: Request) {
  const loginUrl = new URL("/staff-login", request.url).toString();
  return new Response(
    `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${loginUrl}" />
    <title>ログインへ移動中</title>
  </head>
  <body>
    <p>ログイン画面へ移動しています。</p>
    <p><a href="${loginUrl}">移動しない場合はこちら</a></p>
  </body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const expectedRole = String(form.get("expectedRole") ?? "") as "STAFF" | "ADMIN" | "";
  const user = await findLoginUserByEmail(email);
  const retryPath = expectedRole === "ADMIN" ? "/admin-login" : expectedRole === "STAFF" ? "/staff-login" : "/login";

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.redirect(new URL(`${retryPath}?error=1`, request.url), 303);
  }

  if ((expectedRole === "STAFF" || expectedRole === "ADMIN") && user.role !== expectedRole) {
    return NextResponse.redirect(new URL(`${retryPath}?error=role`, request.url), 303);
  }

  await setSession({
    id: user.id,
    role: user.role as "STAFF" | "ADMIN",
    name: user.name,
    department: user.department,
    jobTitle: user.jobTitle,
    weeklyWorkDays: user.weeklyWorkDays,
    weeklyWorkHours: user.weeklyWorkHours
  });
  return NextResponse.redirect(new URL(user.role === "ADMIN" ? "/admin" : "/staff", request.url), 303);
}
