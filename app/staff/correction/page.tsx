import { redirect } from "next/navigation";
import { StaffQuickNav } from "@/components/StaffQuickNav";
import { DirectAttendanceCorrectionForm } from "@/components/StaffForms";
import { requireUser } from "@/lib/auth";
import { getStandardWorkForDate, getStandardWorkMap, getUserMonthAttendanceRecords } from "@/lib/json-db";
import { monthRange, toJstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export default async function StaffCorrectionPage({ searchParams }: Props) {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  const params = await searchParams;
  const month = params.month ?? toJstDateKey().slice(0, 7);
  const { days } = monthRange(month);
  const [monthRecords, todayStandardWork, standardWorkByDate] = await Promise.all([
    getUserMonthAttendanceRecords(user.id, month),
    getStandardWorkForDate(user.id, toJstDateKey()),
    getStandardWorkMap(user.id, month, days)
  ]);
  const registeredDates = monthRecords.filter((record) => record.clockInAt || record.clockOutAt).map((record) => record.workDate);
  const dayOperations = Object.fromEntries(monthRecords.map((record) => [record.workDate, { onCall: record.onCall, emergencyVisits: record.emergencyVisits }]));

  return (
    <main className="staff-shell">
      <a className="secondary" href="/staff">今日の打刻へ戻る</a>
      <section className="card">
        <h2>出退勤の修正</h2>
        <p className="muted">スタッフ側で修正できるのは当月分のみです。修正内容は管理者画面にログとして残ります。</p>
        <DirectAttendanceCorrectionForm month={month} days={days} registeredDates={registeredDates} dayOperations={dayOperations} standardWorkByDate={standardWorkByDate} defaultStandardWork={todayStandardWork} />
      </section>
      <StaffQuickNav />
    </main>
  );
}
