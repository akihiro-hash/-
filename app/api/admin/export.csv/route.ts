import { requireAdmin } from "@/lib/auth";
import { getMonthData, getStaffProfileSettings, getWorkingWeekdaySettings, isScheduledWorkday } from "@/lib/json-db";
import { formatTime, getJstWeekday, minutesToHours, toJstDateKey } from "@/lib/time";
import { getJpHolidayName } from "@/lib/jp-holidays";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function monthDateKeys(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const days = new Date(year, monthIndex, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function isHolidayOrWeekend(dateKey: string) {
  const weekday = getJstWeekday(dateKey);
  return weekday === 0 || weekday === 6 || !!getJpHolidayName(dateKey);
}

function leaveDays(minutes: number) {
  return minutesToHours(minutes) / 8;
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
  const dateKeys = monthDateKeys(month);
  const todayKey = toJstDateKey();
  const recordsByUser = new Map(users.map((user) => [user.id, records.filter((record) => record.userId === user.id)]));
  const leavesByUser = new Map(users.map((user) => [user.id, leaves.filter((leave) => leave.userId === user.id)]));
  const grantsByUser = new Map(users.map((user) => [user.id, paidLeaveGrants.filter((grant) => grant.userId === user.id)]));
  const correctionLogsByUser = new Map(users.map((user) => [user.id, correctionLogs.filter((log) => log.userId === user.id)]));

  function summaryForUser(user: (typeof users)[number]) {
    const userRecords = recordsByUser.get(user.id) ?? [];
    const userLeaves = leavesByUser.get(user.id) ?? [];
    const profile = profileSettings.get(user.id);
    const scheduledDays = dateKeys.filter((dateKey) => isScheduledWorkday(user, dateKey, weekdaySettings) && !getJpHolidayName(dateKey)).length;
    const attendanceDays = new Set(userRecords.filter((record) => record.clockInAt).map((record) => record.workDate)).size;
    const onCallWeekday = userRecords.filter((record) => record.onCall && !isHolidayOrWeekend(record.workDate)).length;
    const onCallHoliday = userRecords.filter((record) => record.onCall && isHolidayOrWeekend(record.workDate)).length;
    const holidayWork = userRecords.filter((record) => record.clockInAt && isHolidayOrWeekend(record.workDate)).length;
    const missing = dateKeys.filter((dateKey) => {
      if (dateKey >= todayKey) return false;
      if (!isScheduledWorkday(user, dateKey, weekdaySettings) || getJpHolidayName(dateKey)) return false;
      const record = userRecords.find((item) => item.workDate === dateKey);
      return !record || !record.clockInAt || !record.clockOutAt;
    }).length;
    const approvedLeaves = userLeaves.filter((leave) => leave.status === "APPROVED");
    const leaveMinutes = (type: string) => approvedLeaves.filter((leave) => leave.leaveType === type).reduce((sum, leave) => sum + leave.requestedMinutes, 0);
    const paidLeaveDays = leaveDays(leaveMinutes("PAID_LEAVE"));
    const compensatoryDays = leaveDays(leaveMinutes("COMPENSATORY_HOLIDAY"));
    const substituteDays = leaveDays(leaveMinutes("SUBSTITUTE_HOLIDAY"));
    const absenceDays = leaveDays(leaveMinutes("ABSENCE"));
    const accountedDays = attendanceDays + paidLeaveDays + compensatoryDays + substituteDays + absenceDays + missing;
    return {
      profile,
      scheduledDays,
      attendanceDays,
      paidLeaveDays,
      compensatoryDays,
      substituteDays,
      absenceDays,
      missing,
      accountedDays,
      workHours: minutesToHours(userRecords.reduce((sum, record) => sum + record.workMins, 0)),
      overtimeHours: minutesToHours(userRecords.reduce((sum, record) => sum + record.overtimeMins, 0)),
      nightHours: minutesToHours(userRecords.reduce((sum, record) => sum + record.nightMins, 0)),
      onCallWeekday,
      onCallHoliday,
      emergencyVisits: userRecords.reduce((sum, record) => sum + record.emergencyVisits, 0),
      holidayWork
    };
  }

  function remainingDaysFor(userId: string, type: string) {
    const grants = grantsByUser.get(userId) ?? [];
    return minutesToHours(grants.filter((grant) => (grant.leaveType ?? "PAID_LEAVE") === type && grant.status !== "EXPIRED").reduce((sum, grant) => sum + grant.remainingMinutes, 0)) / 8;
  }

  const rows = [
    [`社労士提出用 月次勤怠 ${month}`],
    ["先頭は全スタッフ比較用の月次サマリーです。下部にスタッフ別の詳細ブロックがあります。"],
    [],
    ["全スタッフ月次サマリー"],
    ["部署", "職種", "雇用形態", "氏名", "予定勤務日数", "出勤実日数", "有給日数", "振休日数", "代休日数", "欠勤日数", "未打刻/退勤漏れ", "確認用合計", "総勤務時間", "残業目安", "深夜目安", "オンコール平日", "オンコール土日祝", "緊急訪問", "休日出勤"],
    ...users.map((user) => {
      const summary = summaryForUser(user);
      return [
        user.department,
        user.jobTitle ?? "",
        summary.profile?.employmentType ?? "正社員",
        user.name,
        summary.scheduledDays,
        summary.attendanceDays,
        summary.paidLeaveDays,
        summary.compensatoryDays,
        summary.substituteDays,
        summary.absenceDays,
        summary.missing,
        `${summary.accountedDays}/${summary.scheduledDays}`,
        summary.workHours,
        summary.overtimeHours,
        summary.nightHours,
        summary.onCallWeekday,
        summary.onCallHoliday,
        summary.emergencyVisits,
        summary.holidayWork
      ];
    }),
    [],
    ...users.flatMap((user) => {
      const summary = summaryForUser(user);
      const profile = profileSettings.get(user.id);
      const latestWeekdays = weekdaySettings.get(user.id)?.[0]?.weekdays ?? profile?.workingWeekdays ?? [1, 2, 3, 4, 5];
      const userRecords = recordsByUser.get(user.id) ?? [];
      const userLeaves = leavesByUser.get(user.id) ?? [];
      const userGrants = grantsByUser.get(user.id) ?? [];
      const userCorrectionLogs = correctionLogsByUser.get(user.id) ?? [];
      const expiring = userGrants
        .filter((grant) => (grant.leaveType ?? "PAID_LEAVE") === "PAID_LEAVE" && grant.remainingMinutes > 0)
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
      return [
        [],
        [`スタッフ別詳細: ${user.name}`],
        ["基本情報"],
        ["部署", "職種", "雇用形態", "氏名", "入社日", "在籍状態", "退職日", "週所定日数", "週所定時間", "勤務曜日"],
        [
        user.department,
        user.jobTitle ?? "",
        profile?.employmentType ?? "正社員",
        user.name,
        user.hireDate,
        user.employmentStatus === "ACTIVE" ? "在籍中" : "休職・退職",
        user.retirementDate ?? "",
        user.weeklyWorkDays,
        user.weeklyWorkHours,
        latestWeekdays.map((day) => weekdayLabels[day]).join("・")
        ],
        ["月次サマリー"],
        ["予定勤務日数", "出勤実日数", "有給日数", "振休日数", "代休日数", "欠勤日数", "未打刻/退勤漏れ", "確認用合計", "総勤務時間", "残業目安", "深夜目安", "オンコール平日", "オンコール土日祝", "緊急訪問", "休日出勤"],
        [
          summary.scheduledDays,
          summary.attendanceDays,
          summary.paidLeaveDays,
          summary.compensatoryDays,
          summary.substituteDays,
          summary.absenceDays,
          summary.missing,
          `${summary.accountedDays}/${summary.scheduledDays}`,
          summary.workHours,
          summary.overtimeHours,
          summary.nightHours,
          summary.onCallWeekday,
          summary.onCallHoliday,
          summary.emergencyVisits,
          summary.holidayWork
        ],
        ["休暇残数"],
        ["有給残日数", "振休残日数", "代休残日数", "半年以内の失効予定"],
        [
          remainingDaysFor(user.id, "PAID_LEAVE"),
          remainingDaysFor(user.id, "COMPENSATORY_HOLIDAY"),
          remainingDaysFor(user.id, "SUBSTITUTE_HOLIDAY"),
          expiring ? `${expiring.expiresAt} / ${minutesToHours(expiring.remainingMinutes) / 8}日` : ""
        ],
        ["日別明細"],
        ["日付", "曜日", "祝日", "出勤", "退勤", "休憩時間", "勤務時間", "残業目安", "深夜目安", "状態", "オンコール", "緊急訪問", "休暇種別", "休暇単位", "休暇状態", "休暇理由"],
        ...userRecords.map((record) => {
          const weekday = weekdayLabels[getJstWeekday(record.workDate)];
          const leave = leaveMap.get(`${record.userId}:${record.workDate}`);
          return [
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
        ["休暇申請・取得一覧"],
        ["休暇種別", "単位", "午前/午後", "開始日", "終了日", "時間", "状態", "理由"],
        ...userLeaves.map((leave) => [
          leave.leaveType,
          leave.unit,
          leave.halfDayPeriod ?? "",
          leave.startAt.slice(0, 10),
          leave.endAt.slice(0, 10),
          minutesToHours(leave.requestedMinutes),
          leave.status,
          leave.reason
        ]),
        ["有給・代休付与履歴"],
        ["種別", "付与日", "失効日", "付与日数", "残日数", "付与元", "メモ"],
        ...userGrants.map((grant) => [
          grant.leaveType ?? "PAID_LEAVE",
          grant.grantDate,
          grant.expiresAt,
          minutesToHours(grant.grantedMinutes) / 8,
          minutesToHours(grant.remainingMinutes) / 8,
          grant.source,
          grant.note ?? ""
        ]),
        ["勤怠修正ログ"],
        ["対象日", "修正者区分", "修正前出勤", "修正前退勤", "修正後出勤", "修正後退勤", "理由", "記録日時"],
        ...userCorrectionLogs.map((log) => [
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
