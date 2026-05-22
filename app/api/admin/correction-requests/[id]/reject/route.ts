import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decideCorrectionRequest } from "@/lib/json-db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const result = await decideCorrectionRequest(id, admin.id, "REJECTED");
  return NextResponse.json(result);
}
