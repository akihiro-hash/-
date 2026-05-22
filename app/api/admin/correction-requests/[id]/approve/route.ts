import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decideCorrectionRequest } from "@/lib/json-db";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const result = await decideCorrectionRequest(id, admin.id, "APPROVED");
  return NextResponse.json(result);
}
