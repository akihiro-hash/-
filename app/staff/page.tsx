import { redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { LeaveGrantHistoryModal } from "@/components/LeaveGrantHistoryModal";
import { LeaveHistoryModal } from "@/components/LeaveHistoryModal";
import { StaffQuickNav } from "@/components/StaffQuickNav";
import { DailyOperationsForm, DirectAttendanceCorrectionForm, PaidLeaveForm } from "@/components/StaffForms";
import { requireUser } from "@/lib/auth";
import { getAttendanceRecord, getRecentLeaveRequests, getStandardWorkForDate, getStandardWorkMap, getTodayAttendance, getUserMonthAttendanceRecords, leaveSummary } from "@/lib/json-db";
import { addDays, formatDate, formatTime, minutesToHours, monthRange, toJstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

function shiftMonth(month: string, amount: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function StaffPage({ searchParams }: Props) {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  const params = await searchParams;
  const currentMonth = toJstDateKey().slice(0, 7);
  const month = params.month ?? currentMonth;
  const { days } = monthRange(month);
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const [today, yesterday, leave, monthRecords, todayStandardWork, standardWorkByDate, requests] = await Promise.all([
    getTodayAttendance(user.id),
    getAttendanceRecord(user.id, toJstDateKey(addDays(new Date(), -1))),
    leaveSummary(user.id),
    getUserMonthAttendanceRecords(user.id, month),
    getStandardWorkForDate(user.id, toJstDateKey()),
    getStandardWorkMap(user.id, month, days),
    getRecentLeaveRequests(user.id)
  ]);
  const recordMap = new Map(monthRecords.map((record) => [record.workDate, record]));
  const registeredDates = monthRecords
    .filter((record) => record.clockInAt || record.clockOutAt)
    .map((record) => record.workDate);
  const dayOperations = Object.fromEntries(
    monthRecords.map((record) => [record.workDate, { onCall: record.onCall, emergencyVisits: record.emergencyVisits }])
  );

  return (
    <main className="staff-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">スタッフ</p>
          <h1>{user.name}</h1>
          <p className="muted">{user.department}</p>
        </div>
        <form action="/api/auth/logout" method="post" className="no-print">
          <button className="secondary">ログアウト</button>
        </form>
      </header>

      {leave.expiring.length > 0 && (
        <section className="card alert">
          <h2>有給の失効予定</h2>
          {leave.expiring.map((grant) => (
            <p key={grant.id}>
              {grant.expiresAt}
              までに {minutesToHours(grant.remainingMinutes)} 時間が失効予定です。
            </p>
          ))}
        </section>
      )}

      <StaffQuickNav />

      <section className="card stack" id="staff-today">
        <h2>今日の打刻</h2>
        <div className="metric-row">
          <div className="metric">
            <span>出勤</span>
            <strong>{formatTime(today.clockInAt ? new Date(today.clockInAt) : null) || "--:--"}</strong>
          </div>
          <div className="metric">
            <span>退勤</span>
            <strong>{formatTime(today.clockOutAt ? new Date(today.clockOutAt) : null) || "--:--"}</strong>
          </div>
          <div className="metric">
            <span>勤務</span>
            <strong>{minutesToHours(today.workMins)}h</strong>
          </div>
        </div>
        <div className="clock-grid no-print">
          <ActionButton endpoint="/api/clock-in" className="primary">出勤</ActionButton>
          <ActionButton endpoint="/api/clock-out" className="primary" successMessage="今日も一日お疲れさまでした">退勤</ActionButton>
          <ActionButton endpoint="/api/standard-work" className="secondary">通常勤務 {todayStandardWork.label}</ActionButton>
        </div>
      </section>

      <section className="card">
        <h2>オンコール・緊急訪問</h2>
        <DailyOperationsForm onCall={today.onCall} yesterdayVisits={yesterday.emergencyVisits} />
      </section>

      <section className="card" id="staff-leave-balance">
        <div className="section-heading">
          <h2>休暇残数</h2>
          <LeaveGrantHistoryModal grants={leave.grants} />
        </div>
        <div className="metric-row">
          <div className="metric">
            <span>有給</span>
            <strong>{minutesToHours(leave.byType.PAID_LEAVE ?? 0)}h</strong>
            <small>{minutesToHours(leave.byType.PAID_LEAVE ?? 0) / 8}日</small>
          </div>
          <div className="metric">
            <span>代休</span>
            <strong>{minutesToHours(leave.byType.SUBSTITUTE_HOLIDAY ?? 0)}h</strong>
            <small>{minutesToHours(leave.byType.SUBSTITUTE_HOLIDAY ?? 0) / 8}日</small>
          </div>
          <div className="metric">
            <span>振休</span>
            <strong>{minutesToHours(leave.byType.COMPENSATORY_HOLIDAY ?? 0)}h</strong>
            <small>{minutesToHours(leave.byType.COMPENSATORY_HOLIDAY ?? 0) / 8}日</small>
          </div>
          <div className="metric">
            <span>失効注意</span>
            <strong>{leave.expiring.length}件</strong>
            <small>180日以内</small>
          </div>
          <LeaveHistoryModal requests={requests} />
        </div>
      </section>

      <details className="card accordion-card" id="staff-leave">
        <summary className="accordion-summary">休暇申請</summary>
        <div className="accordion-body">
          <PaidLeaveForm />
        </div>
      </details>

      <details className="card accordion-card" id="staff-correction">
        <summary className="accordion-summary">出退勤の修正</summary>
        <div className="accordion-body">
          <p className="muted">スタッフ側で修正できるのは当月分のみです。修正内容は管理者画面にログとして残ります。</p>
          <DirectAttendanceCorrectionForm month={month} days={days} registeredDates={registeredDates} dayOperations={dayOperations} standardWorkByDate={standardWorkByDate} defaultStandardWork={todayStandardWork} />
        </div>
      </details>

      <details className="card accordion-card" id="staff-month">
        <summary className="accordion-summary">{month} の勤怠</summary>
        <div className="accordion-body">
        <div className="section-heading">
          <div className="month-actions">
            <a className="secondary" href={`/staff?month=${previousMonth}`}>先月</a>
            <a className="secondary" href={`/staff?month=${currentMonth}`}>今月</a>
            <a className="secondary" href={`/staff?month=${nextMonth}`}>翌月</a>
          </div>
        </div>
        <div className="day-list">
          {Array.from({ length: days }, (_, index) => {
            const dateKey = `${month}-${String(index + 1).padStart(2, "0")}`;
            const record = recordMap.get(dateKey);
            const date = new Date(`${dateKey}T00:00:00+09:00`);
            return (
            <div className={`day-item ${record?.onCall ? "day-item-oncall" : ""}`} key={dateKey}>
              <strong>{formatDate(date)}</strong>
              <span>
                {formatTime(record?.clockInAt ? new Date(record.clockInAt) : null) || "--:--"} - {formatTime(record?.clockOutAt ? new Date(record.clockOutAt) : null) || "--:--"} / {minutesToHours(record?.workMins ?? 0)}h
              </span>
              <span className="muted">{record?.onCall ? "オンコール" : "通常"} / 緊急訪問 {record?.emergencyVisits ?? 0}回</span>
              <span className="muted">{record?.status ?? "未入力"}</span>
            </div>
            );
          })}
        </div>
        </div>
      </details>
    </main>
  );
}
