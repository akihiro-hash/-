import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { findUserByEmail } from "@/lib/json-db";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const user = findUserByEmail(email);

  if (!user || password !== "password123") {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  await setSession(user.id, user.role);
  return NextResponse.redirect(new URL(user.role === "ADMIN" ? "/admin" : "/staff", request.url), 303);
}
