import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/json-db";
import { toJstDateKey } from "@/lib/time";

type Cell = string | number | boolean | null | undefined;

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sheetName(value: string) {
  return value.replace(/[\\/?*:[\]]/g, "").slice(0, 31) || "sheet";
}

function cellXml(value: Cell, style = "Default") {
  const type = typeof value === "number" ? "Number" : "String";
  return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
}

function rowXml(cells: Cell[], style = "Default") {
  return `<Row>${cells.map((cell) => cellXml(cell, style)).join("")}</Row>`;
}

function worksheet(name: string, headers: string[], rows: Cell[][]) {
  const columns = Array.from({ length: Math.max(headers.length, 1) }, () => '<Column ss:AutoFitWidth="1" ss:Width="110"/>').join("");
  const content = [
    rowXml(headers, "Header"),
    ...rows.map((row) => rowXml(row))
  ].join("");
  return `<Worksheet ss:Name="${xml(sheetName(name))}"><Table>${columns}${content}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
}

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const exportedAt = new Date().toISOString();
  const data = await readDb();
  const dateKey = toJstDateKey();

  const sheets = [
    worksheet("概要", ["項目", "値"], [
      ["アプリ", "kintai-app-smilo"],
      ["種別", "全データバックアップ"],
      ["出力日時", exportedAt],
      ["スタッフ数", data.users.length],
      ["勤怠記録数", data.attendanceRecords.length],
      ["有給付与履歴数", data.paidLeaveGrants.length],
      ["休暇申請数", data.paidLeaveRequests.length],
      ["勤怠修正申請数", data.correctionRequests.length],
      ["勤怠修正ログ数", data.correctionLogs.length]
    ]),
    worksheet("スタッフ", ["id", "氏名", "メール", "権限", "部署", "職種", "入社日", "週所定日数", "週所定時間", "在籍状態", "退職日"], data.users.map((user) => [
      user.id, user.name, user.email, user.role, user.department, user.jobTitle ?? "", user.hireDate, user.weeklyWorkDays, user.weeklyWorkHours, user.employmentStatus, user.retirementDate ?? ""
    ])),
    worksheet("勤怠記録", ["id", "userId", "日付", "出勤", "退勤", "休憩分", "勤務分", "残業分", "深夜分", "状態"], data.attendanceRecords.map((record) => [
      record.id, record.userId, record.workDate, record.clockInAt ?? "", record.clockOutAt ?? "", record.totalBreakMins, record.workMins, record.overtimeMins, record.nightMins, record.status
    ])),
    worksheet("有給等付与", ["id", "userId", "種別", "付与日", "失効日", "付与分", "残分", "付与元", "状態", "メモ"], data.paidLeaveGrants.map((grant) => [
      grant.id, grant.userId, grant.leaveType ?? "PAID_LEAVE", grant.grantDate, grant.expiresAt, grant.grantedMinutes, grant.remainingMinutes, grant.source, grant.status, grant.note ?? ""
    ])),
    worksheet("休暇申請", ["id", "userId", "種別", "単位", "午前午後", "開始", "終了", "申請分", "理由", "状態", "承認者", "確認日時"], data.paidLeaveRequests.map((request) => [
      request.id, request.userId, request.leaveType, request.unit, request.halfDayPeriod ?? "", request.startAt, request.endAt, request.requestedMinutes, request.reason, request.status, request.approverId ?? "", request.reviewedAt ?? ""
    ])),
    worksheet("勤怠修正申請", ["id", "userId", "対象日", "出勤修正", "退勤修正", "理由", "状態", "承認者", "確認日時"], data.correctionRequests.map((request) => [
      request.id, request.userId, request.targetDate, request.requestedClockInAt ?? "", request.requestedClockOutAt ?? "", request.reason, request.status, request.approverId ?? "", request.reviewedAt ?? ""
    ])),
    worksheet("勤怠修正ログ", ["id", "userId", "対象日", "操作者", "操作者区分", "修正前出勤", "修正前退勤", "修正後出勤", "修正後退勤", "理由", "記録日時"], data.correctionLogs.map((log) => [
      log.id, log.userId, log.targetDate, log.actorId, log.actorRole, log.beforeClockInAt ?? "", log.beforeClockOutAt ?? "", log.afterClockInAt ?? "", log.afterClockOutAt ?? "", log.reason, log.createdAt
    ]))
  ];

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="Default"><Font ss:FontName="Yu Gothic" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EADFCB"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EADFCB"/></Borders></Style>
<Style ss:ID="Header"><Font ss:FontName="Yu Gothic" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#E8EEF5" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#9AB7C6"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9AB7C6"/></Borders></Style>
</Styles>
${sheets.join("")}
</Workbook>`;

  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="kintai-backup-${dateKey}.xls"`
    }
  });
}
