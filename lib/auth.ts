import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual, pbkdf2Sync } from "node:crypto";
import { findUserById } from "@/lib/json-db";

const COOKIE_NAME = "attendance_session";

type SessionPayload = {
  userId: string;
  role: "STAFF" | "ADMIN";
  exp: number;
};

function secret() {
  return process.env.AUTH_SECRET ?? "local-dev-secret-change-me";
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const candidate = pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">) {
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 12 }));
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature || sign(body) !== signature) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  let session: SessionPayload | null = null;
  try {
    session = readSessionToken(cookieStore.get(COOKIE_NAME)?.value);
  } catch {
    return null;
  }
  if (!session) return null;
  try {
    return await findUserById(session.userId);
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/staff");
  return user;
}

export async function setSession(userId: string, role: "STAFF" | "ADMIN") {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken({ userId, role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
