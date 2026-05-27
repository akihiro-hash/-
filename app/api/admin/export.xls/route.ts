import { requireAdmin } from "@/lib/auth";
import { getMonthData, getStaffProfileSettings, getWorkingWeekdaySettings, isScheduledWorkday } from "@/lib/json-db";
import { formatTime, minutesToHours, toJstDateKey } from "@/lib/time";
import { getJpHolidayName } from "@/lib/jp-holidays";

type Cell = string | number | { value: string | number; style?: string };

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function monthDateKeys(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const days = new Date(year, monthIndex, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function isHolidayOrWeekend(dateKey: string) {
  const weekday = new Date(`${dateKey}T00:00:00+09:00`).getDay();
  return weekday === 0 || weekday === 6 || !!getJpHolidayName(dateKey);
}

function leaveDays(minutes: number) {
  return minutesToHours(minutes) / 8;
}

function sheetName(value: string) {
  return value.replace(/[\\/?*:[\]]/g, "").slice(0, 31) || "sheet";
}

function cellXml(input: Cell, fallbackStyle = "Default") {
  const cell = typeof input === "object" && input !== null ? input : { value: input };
  const value = cell.value;
  const type = typeof value === "number" ? "Number" : "String";
  return `<Cell ss:StyleID="${cell.style ?? fallbackStyle}"><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
}

function rowXml(cells: Cell[], style = "Default") {
  return `<Row>${cells.map((cell) => cellXml(cell, style)).join("")}</Row>`;
}

function worksheet(name: string, rows: string[]) {
  const columns = Array.from({ length: 20 }, () => '<Column ss:AutoFitWidth="1" ss:Width="96"/>').join("");
  return `<Worksheet ss:Name="${xml(sheetName(name))}"><Table>${columns}${rows.join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
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
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const dateKeys = monthDateKeys(month);
  const todayKey = toJstDateKey();
  const recordsByUser = new Map(users.map((user) => [user.id, records.filter((record) => record.userId === user.id)]));
  const leavesByUser = new Map(users.map((user) => [user.id, leaves.filter((leave) => leave.userId === user.id)]));
  const grantsByUser = new Map(users.map((user) => [user.id, paidLeaveGrants.filter((grant) => grant.userId === user.id)]));
  const correctionLogsByUser = new Map(users.map((user) => [user.id, correctionLogs.filter((log) => log.userId === user.id)]));
  const leaveMap = new Map(leaves.map((leave) => [`${leave.userId}:${leave.startAt.slice(0, 10)}`, leave]));

  function summaryForUser(user: (typeof users)[number]) {
    const userRecords = recordsByUser.get(user.id) ?? [];
    const userLeaves = leavesByUser.get(user.id) ?? [];
    const profile = profileSettings.get(user.id);
    const scheduledDays = dateKeys.filter((dateKey) => isScheduledWorkday(user, dateKey, weekdaySettings) && !getJpHolidayName(dateKey)).length;
    const attendanceDays = new Set(userRecords.filter((record) => record.clockInAt).map((record) => record.workDate)).size;
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
    return {
      profile,
      scheduledDays,
      attendanceDays,
      paidLeaveDays,
      compensatoryDays,
      substituteDays,
      absenceDays,
      missing,
      accountedDays: attendanceDays + paidLeaveDays + compensatoryDays + substituteDays + absenceDays + missing,
      workHours: minutesToHours(userRecords.reduce((sum, record) => sum + record.workMins, 0)),
      overtimeHours: minutesToHours(userRecords.reduce((sum, record) => sum + record.overtimeMins, 0)),
      nightHours: minutesToHours(userRecords.reduce((sum, record) => sum + record.nightMins, 0)),
      onCallWeekday: userRecords.filter((record) => record.onCall && !isHolidayOrWeekend(record.workDate)).length,
      onCallHoliday: userRecords.filter((record) => record.onCall && isHolidayOrWeekend(record.workDate)).length,
      emergencyVisits: userRecords.reduce((sum, record) => sum + record.emergencyVisits, 0),
      holidayWork: userRecords.filter((record) => record.clockInAt && isHolidayOrWeekend(record.workDate)).length
    };
  }

  function remainingDaysFor(userId: string, type: string) {
    const grants = grantsByUser.get(userId) ?? [];
    return minutesToHours(grants.filter((grant) => (grant.leaveType ?? "PAID_LEAVE") === type && grant.status !== "EXPIRED").reduce((sum, grant) => sum + grant.remainingMinutes, 0)) / 8;
  }

  const summaryRows = [
    rowXml([{ value: `社労士提出用 月次勤怠 ${month}`, style: "Title" }]),
    rowXml(["色付きセルは確認ポイントです。赤: 未打刻/退勤漏れ、橙: 残業15時間以上、黄: 休日出勤あり"]),
    rowXml([]),
    rowXml(["部署", "職種", "雇用形態", "氏名", "予定勤務日数", "出勤実日数", "有給日数", "振休日数", "代休日数", "欠勤日数", "未打刻/退勤漏れ", "確認用合計", "総勤務時間", "残業目安", "深夜目安", "オンコール平日", "オンコール土日祝", "緊急訪問", "休日出勤"], "Header"),
    ...users.map((user) => {
      const summary = summaryForUser(user);
      const rowStyle = summary.missing > 0 ? "Alert" : summary.overtimeHours >= 15 ? "Warn" : summary.holidayWork > 0 ? "Notice" : "Default";
      return rowXml([
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
      ], rowStyle);
    })
  ];

  const staffSheets = users.map((user) => {
    const summary = summaryForUser(user);
    const profile = profileSettings.get(user.id);
    const latestWeekdays = weekdaySettings.get(user.id)?.[0]?.weekdays ?? profile?.workingWeekdays ?? [1, 2, 3, 4, 5];
    const userRecords = recordsByUser.get(user.id) ?? [];
    const userLeaves = leavesByUser.get(user.id) ?? [];
    const userGrants = grantsByUser.get(user.id) ?? [];
    const userCorrectionLogs = correctionLogsByUser.get(user.id) ?? [];
    const expiring = userGrants.filter((grant) => (grant.leaveType ?? "PAID_LEAVE") === "PAID_LEAVE" && grant.remainingMinutes > 0).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
    const rows = [
      rowXml([{ value: `${user.name} ${month}`, style: "Title" }]),
      rowXml(["基本情報"], "Section"),
      rowXml(["部署", "職種", "雇用形態", "氏名", "入社日", "在籍状態", "週所定日数", "週所定時間", "勤務曜日"], "Header"),
      rowXml([user.department, user.jobTitle ?? "", profile?.employmentType ?? "正社員", user.name, user.hireDate, user.employmentStatus === "ACTIVE" ? "在籍中" : "休職・退職", user.weeklyWorkDays, user.weeklyWorkHours, latestWeekdays.map((day) => weekdayLabels[day]).join("・")]),
      rowXml(["月次サマリー"], "Section"),
      rowXml(["予定勤務日数", "出勤実日数", "有給日数", "振休日数", "代休日数", "欠勤日数", "未打刻/退勤漏れ", "確認用合計", "総勤務時間", "残業目安", "深夜目安", "オンコール平日", "オンコール土日祝", "緊急訪問", "休日出勤"], "Header"),
      rowXml([summary.scheduledDays, summary.attendanceDays, summary.paidLeaveDays, summary.compensatoryDays, summary.substituteDays, summary.absenceDays, summary.missing, `${summary.accountedDays}/${summary.scheduledDays}`, summary.workHours, summary.overtimeHours, summary.nightHours, summary.onCallWeekday, summary.onCallHoliday, summary.emergencyVisits, summary.holidayWork], summary.missing > 0 ? "Alert" : "Default"),
      rowXml(["休暇残数"], "Section"),
      rowXml(["有給残日数", "振休残日数", "代休残日数", "半年以内の失効予定"], "Header"),
      rowXml([remainingDaysFor(user.id, "PAID_LEAVE"), remainingDaysFor(user.id, "COMPENSATORY_HOLIDAY"), remainingDaysFor(user.id, "SUBSTITUTE_HOLIDAY"), expiring ? `${expiring.expiresAt} / ${minutesToHours(expiring.remainingMinutes) / 8}日` : ""]),
      rowXml(["日別明細"], "Section"),
      rowXml(["日付", "曜日", "祝日", "出勤", "退勤", "休憩時間", "勤務時間", "残業目安", "深夜目安", "状態", "オンコール", "緊急訪問", "休暇種別", "休暇単位", "休暇状態", "休暇理由"], "Header"),
      ...userRecords.map((record) => {
        const leave = leaveMap.get(`${record.userId}:${record.workDate}`);
        const weekday = weekdayLabels[new Date(`${record.workDate}T00:00:00+09:00`).getDay()];
        const rowStyle = record.status === "MISSING_CLOCK" ? "Alert" : record.overtimeMins >= 60 ? "Warn" : isHolidayOrWeekend(record.workDate) && record.clockInAt ? "Notice" : record.onCall ? "OnCall" : "Default";
        return rowXml([record.workDate, weekday, getJpHolidayName(record.workDate) ?? "", formatTime(record.clockInAt ? new Date(record.clockInAt) : null), formatTime(record.clockOutAt ? new Date(record.clockOutAt) : null), minutesToHours(record.totalBreakMins), minutesToHours(record.workMins), minutesToHours(record.overtimeMins), minutesToHours(record.nightMins), record.status, record.onCall ? "あり" : "", record.emergencyVisits, leave?.leaveType ?? "", leave?.unit ?? "", leave?.status ?? "", leave?.reason ?? ""], rowStyle);
      }),
      rowXml(["休暇申請・取得一覧"], "Section"),
      rowXml(["休暇種別", "単位", "午前/午後", "開始日", "終了日", "時間", "状態", "理由"], "Header"),
      ...userLeaves.map((leave) => rowXml([leave.leaveType, leave.unit, leave.halfDayPeriod ?? "", leave.startAt.slice(0, 10), leave.endAt.slice(0, 10), minutesToHours(leave.requestedMinutes), leave.status, leave.reason], leave.status === "PENDING" ? "Notice" : "Default")),
      rowXml(["有給・代休付与履歴"], "Section"),
      rowXml(["種別", "付与日", "失効日", "付与日数", "残日数", "付与元", "メモ"], "Header"),
      ...userGrants.map((grant) => rowXml([grant.leaveType ?? "PAID_LEAVE", grant.grantDate, grant.expiresAt, minutesToHours(grant.grantedMinutes) / 8, minutesToHours(grant.remainingMinutes) / 8, grant.source, grant.note ?? ""], grant.remainingMinutes > 0 ? "Default" : "Muted")),
      rowXml(["勤怠修正ログ"], "Section"),
      rowXml(["対象日", "修正者区分", "修正前出勤", "修正前退勤", "修正後出勤", "修正後退勤", "理由", "記録日時"], "Header"),
      ...userCorrectionLogs.map((log) => rowXml([log.targetDate, log.actorRole, formatTime(log.beforeClockInAt ? new Date(log.beforeClockInAt) : null), formatTime(log.beforeClockOutAt ? new Date(log.beforeClockOutAt) : null), formatTime(log.afterClockInAt ? new Date(log.afterClockInAt) : null), formatTime(log.afterClockOutAt ? new Date(log.afterClockOutAt) : null), log.reason, log.createdAt], "Notice"))
    ];
    return worksheet(user.name, rows);
  });

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="Default"><Font ss:FontName="Yu Gothic" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EADFCB"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EADFCB"/></Borders></Style>
<Style ss:ID="Title"><Font ss:FontName="Yu Gothic" ss:Size="14" ss:Bold="1" ss:Color="#2D2520"/><Interior ss:Color="#DFF3E7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2F7D68"/></Borders></Style>
<Style ss:ID="Header"><Font ss:FontName="Yu Gothic" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#E9F3F7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#9AB7C6"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9AB7C6"/></Borders></Style>
<Style ss:ID="Section"><Font ss:FontName="Yu Gothic" ss:Size="11" ss:Bold="1" ss:Color="#246452"/><Interior ss:Color="#FFF4DB" ss:Pattern="Solid"/></Style>
<Style ss:ID="Alert"><Interior ss:Color="#FFDFDA" ss:Pattern="Solid"/><Font ss:FontName="Yu Gothic" ss:Size="10" ss:Color="#B42318" ss:Bold="1"/></Style>
<Style ss:ID="Warn"><Interior ss:Color="#FFE8C2" ss:Pattern="Solid"/><Font ss:FontName="Yu Gothic" ss:Size="10" ss:Color="#B54708" ss:Bold="1"/></Style>
<Style ss:ID="Notice"><Interior ss:Color="#FFF4DB" ss:Pattern="Solid"/></Style>
<Style ss:ID="OnCall"><Interior ss:Color="#F7E7C9" ss:Pattern="Solid"/></Style>
<Style ss:ID="Muted"><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/><Font ss:Color="#756A60"/></Style>
</Styles>
${worksheet("全体サマリー", summaryRows)}
${staffSheets.join("")}
</Workbook>`;

  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${month}.xls"`
    }
  });
}
