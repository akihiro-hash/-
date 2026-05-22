import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST() {
  const user = await requireUser();
  const { updateAttendance } = await import("@/lib/json-db");
  const result = await updateAttendance(user.id, "CLOCK_OUT");
  return NextResponse.json(result);
}
