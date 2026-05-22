import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { setTodayStandardWork } from "@/lib/json-db";

export async function POST() {
  const user = await requireUser();
  const result = await setTodayStandardWork(user.id);
  return NextResponse.json(result);
}
