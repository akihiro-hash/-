import { redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { StaffQuickNav } from "@/components/StaffQuickNav";
import { DailyOperationsForm } from "@/components/StaffForms";
import { requireUser } from "@/lib/auth";
import { findAttendanceRecord, getStandardWorkForDate } from "@/lib/json-db";
import { addDays, formatTime, minutesToHours, toJstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");

  const todayKey = toJstDateKey();
  const yesterdayKey = toJstDateKey(addDays(new Date(), -1));
  const [today, yesterday, todayStandardWork] = await Promise.all([
    findAttendanceRecord(user.id, todayKey),
    findAttendanceRecord(user.id, yesterdayKey),
    getStandardWorkForDate(user.id, todayKey)
  ]);

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

      <section className="card stack">
        <h2>メニュー</h2>
        <div className="staff-menu-grid">
          <a className="secondary" href="/staff/leave">休暇申請・残数</a>
          <a className="secondary" href="/staff/correction">出退勤の修正</a>
          <a className="secondary" href="/staff/month">今月の勤怠</a>
        </div>
      </section>
      <StaffQuickNav />
    </main>
  );
}
