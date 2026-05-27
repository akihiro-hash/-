import { requireAdmin } from "@/lib/auth";
import { getMonthData, getStaffProfileSettings, getWorkingWeekdaySettings } from "@/lib/json-db";
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
  const { users, records, leaves, correctionLogs, paidLeaveGrants } = await getMonthData(month);
  const [profileSettings, weekdaySettings] = await Promise.all([
    getStaffProfileSettings(users.map((user) => user.id)),
    getWorkingWeekdaySettings(users.map((user) => user.id))
  ]);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const leaveMap = new Map(leaves.map((leave) => [`${leave.userId}:${leave.startAt.slice(0, 10)}`, leave]));
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  const rows = [
    [`社労士提出用 月次勤怠 ${month}`],
    [],
    ["スタッフ一覧"],
    ["部署", "職種", "雇用形態", "氏名", "入社日", "在籍状態", "週所定日数", "週所定時間", "勤務曜日"],
    ...users.map((user) => {
      const profile = profileSettings.get(user.id);
      const latestWeekdays = weekdaySettings.get(user.id)?.[0]?.weekdays ?? profile?.workingWeekdays ?? [1, 2, 3, 4, 5];
      return [
        user.department,
        user.jobTitle ?? "",
        profile?.employmentType ?? "正社員",
        user.name,
        user.hireDate,
        user.employmentStatus === "ACTIVE" ? "在籍中" : "休職・退職",
        user.weeklyWorkDays,
        user.weeklyWorkHours,
        latestWeekdays.map((day) => weekdayLabels[day]).join("・")
      ];
    }),
    [],
    ["月次勤怠"],
    ["部署", "職種", "雇用形態", "氏名", "日付", "曜日", "祝日", "出勤", "退勤", "休憩時間", "勤務時間", "残業目安", "深夜目安", "状態", "オンコール", "緊急訪問", "休暇種別", "休暇単位", "休暇状態", "休暇理由"],
    ...records.map((record) => {
      const user = userMap.get(record.userId);
      const profile = profileSettings.get(record.userId);
      const weekday = weekdayLabels[new Date(`${record.workDate}T00:00:00+09:00`).getDay()];
      const leave = leaveMap.get(`${record.userId}:${record.workDate}`);
      return [
      user?.department ?? "",
      user?.jobTitle ?? "",
      profile?.employmentType ?? "正社員",
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
      leave?.unit ?? "",
      leave?.status ?? "",
      leave?.reason ?? ""
    ];
    }),
    [],
    ["休暇申請・取得一覧"],
    ["氏名", "休暇種別", "単位", "午前/午後", "開始日", "終了日", "時間", "状態", "理由"],
    ...leaves.map((leave) => [
      userMap.get(leave.userId)?.name ?? "",
      leave.leaveType,
      leave.unit,
      leave.halfDayPeriod ?? "",
      leave.startAt.slice(0, 10),
      leave.endAt.slice(0, 10),
      minutesToHours(leave.requestedMinutes),
      leave.status,
      leave.reason
    ]),
    [],
    ["有給・代休付与履歴"],
    ["氏名", "種別", "付与日", "失効日", "付与日数", "残日数", "付与元", "メモ"],
    ...paidLeaveGrants.map((grant) => [
      userMap.get(grant.userId)?.name ?? "",
      grant.leaveType ?? "PAID_LEAVE",
      grant.grantDate,
      grant.expiresAt,
      minutesToHours(grant.grantedMinutes) / 8,
      minutesToHours(grant.remainingMinutes) / 8,
      grant.source,
      grant.note ?? ""
    ]),
    [],
    ["勤怠修正ログ"],
    ["氏名", "対象日", "修正者区分", "修正前出勤", "修正前退勤", "修正後出勤", "修正後退勤", "理由", "記録日時"],
    ...correctionLogs.map((log) => [
      userMap.get(log.userId)?.name ?? "",
      log.targetDate,
      log.actorRole,
      formatTime(log.beforeClockInAt ? new Date(log.beforeClockInAt) : null),
      formatTime(log.beforeClockOutAt ? new Date(log.beforeClockOutAt) : null),
      formatTime(log.afterClockInAt ? new Date(log.afterClockInAt) : null),
      formatTime(log.afterClockOutAt ? new Date(log.afterClockOutAt) : null),
      log.reason,
      log.createdAt
    ])
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${month}.csv"`
    }
  });
}
