import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserMonthAttendanceRecords } from "@/lib/json-db";
import { formatDate, formatTime, minutesToHours, monthRange, toJstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

function shiftMonth(month: string, amount: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function StaffMonthPage({ searchParams }: Props) {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  const params = await searchParams;
  const currentMonth = toJstDateKey().slice(0, 7);
  const month = params.month ?? currentMonth;
  const { days } = monthRange(month);
  const records = await getUserMonthAttendanceRecords(user.id, month);
  const recordMap = new Map(records.map((record) => [record.workDate, record]));

  return (
    <main className="staff-shell">
      <a className="secondary" href="/staff">今日の打刻へ戻る</a>
      <section className="card">
        <div className="section-heading">
          <h2>{month} の勤怠</h2>
          <div className="month-actions">
            <a className="secondary" href={`/staff/month?month=${shiftMonth(month, -1)}`}>先月</a>
            <a className="secondary" href={`/staff/month?month=${currentMonth}`}>今月</a>
            <a className="secondary" href={`/staff/month?month=${shiftMonth(month, 1)}`}>翌月</a>
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
                <span>{formatTime(record?.clockInAt ? new Date(record.clockInAt) : null) || "--:--"} - {formatTime(record?.clockOutAt ? new Date(record.clockOutAt) : null) || "--:--"} / {minutesToHours(record?.workMins ?? 0)}h</span>
                <span className="muted">{record?.onCall ? "オンコール" : "通常"} / 緊急訪問 {record?.emergencyVisits ?? 0}回</span>
                <span className="muted">{record?.status ?? "未入力"}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
