import { requireAdmin } from "@/lib/auth";
import { getMonthData } from "@/lib/json-db";
import { formatTime, minutesToHours, toJstDateKey } from "@/lib/time";
import { getJpHolidayName } from "@/lib/jp-holidays";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? toJstDateKey().slice(0, 7);
  const { users, records, leaves } = await getMonthData(month);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const leaveMap = new Map(leaves.map((leave) => [`${leave.userId}:${leave.startAt.slice(0, 10)}`, leave]));

  const rows = [
    ["部署", "職種", "氏名", "日付", "曜日", "祝日", "出勤", "退勤", "休憩時間", "勤務時間", "残業目安", "深夜目安", "状態", "オンコール", "緊急訪問", "休暇種別", "休暇状態"],
    ...records.map((record) => {
      const user = userMap.get(record.userId);
      const weekday = ["日", "月", "火", "水", "木", "金", "土"][new Date(`${record.workDate}T00:00:00+09:00`).getDay()];
      const leave = leaveMap.get(`${record.userId}:${record.workDate}`);
      return [
      user?.department ?? "",
      user?.jobTitle ?? "",
      user?.name ?? "",
      record.workDate,
      weekday,
      getJpHolidayName(record.workDate) ?? "",
      formatTime(record.clockInAt ? new Date(record.clockInAt) : null),
      formatTime(record.clockOutAt ? new Date(record.clockOutAt) : null),
      minutesToHours(record.totalBreakMins),
      minutesToHours(record.workMins),
      minutesToHours(record.overtimeMins),
      minutesToHours(record.nightMins),
      record.status,
      record.onCall ? "あり" : "",
      record.emergencyVisits,
      leave?.leaveType ?? "",
      leave?.status ?? ""
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
