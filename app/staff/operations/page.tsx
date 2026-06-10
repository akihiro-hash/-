import { redirect } from "next/navigation";
import { StaffQuickNav } from "@/components/StaffQuickNav";
import { DailyOperationsForm } from "@/components/StaffForms";
import { requireUser } from "@/lib/auth";
import { findAttendanceRecord } from "@/lib/json-db";
import { addDays, toJstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function StaffOperationsPage() {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");

  const todayKey = toJstDateKey();
  const yesterdayKey = toJstDateKey(addDays(new Date(), -1));
  const [today, yesterday] = await Promise.all([
    findAttendanceRecord(user.id, todayKey),
    findAttendanceRecord(user.id, yesterdayKey)
  ]);

  return (
    <main className="staff-shell">
      <a className="secondary" href="/staff">今日の打刻へ戻る</a>
      <section className="card">
        <h2>オンコール・緊急訪問</h2>
        <DailyOperationsForm onCall={today.onCall} yesterdayVisits={yesterday.emergencyVisits} />
      </section>
      <StaffQuickNav />
    </main>
  );
}
