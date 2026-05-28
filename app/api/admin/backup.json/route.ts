import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/json-db";
import { toJstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const exportedAt = new Date().toISOString();
  const backup = {
    app: "kintai-app-smilo",
    kind: "full-data-backup",
    version: 1,
    exportedAt,
    data: await readDb()
  };
  const dateKey = toJstDateKey();
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kintai-backup-${dateKey}.json"`
    }
  });
}
