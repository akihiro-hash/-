import { requireAdmin } from "@/lib/auth";
import { getMonthData } from "@/lib/json-db";
import { formatTime, minutesToHours, toJstDateKey } from "@/lib/time";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? toJstDateKey().slice(0, 7);
  const { users, records } = await getMonthData(month);
  const userMap = new Map(users.map((user) => [user.id, user]));

  const rows = [
    ["部署", "氏名", "日付", "出勤", "退勤", "休憩時間", "勤務時間", "残業目安", "深夜目安", "状態"],
    ...records.map((record) => {
      const user = userMap.get(record.userId);
      return [
      user?.department ?? "",
      user?.name ?? "",
      record.workDate,
      formatTime(record.clockInAt ? new Date(record.clockInAt) : null),
      formatTime(record.clockOutAt ? new Date(record.clockOutAt) : null),
      minutesToHours(record.totalBreakMins),
      minutesToHours(record.workMins),
      minutesToHours(record.overtimeMins),
      minutesToHours(record.nightMins),
      record.status
    ];
    })
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${month}.csv"`
    }
  });
}
