import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addDays, toJstDateKey } from "@/lib/time";
import { updateDailyOperations } from "@/lib/json-db";

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const today = new Date();
  const yesterday = toJstDateKey(addDays(today, -1));

  await updateDailyOperations({
    userId: user.id,
    targetDate: toJstDateKey(today),
    onCall: form.get("onCall") === "on"
  });

  const result = await updateDailyOperations({
    userId: user.id,
    targetDate: yesterday,
    emergencyVisits: Number(form.get("emergencyVisits") ?? 0)
  });

  return NextResponse.json(result);
}
