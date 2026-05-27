import { redirect } from "next/navigation";
import { LeaveGrantHistoryModal } from "@/components/LeaveGrantHistoryModal";
import { LeaveHistoryModal } from "@/components/LeaveHistoryModal";
import { PaidLeaveForm } from "@/components/StaffForms";
import { requireUser } from "@/lib/auth";
import { getRecentLeaveRequests, leaveSummary } from "@/lib/json-db";
import { minutesToHours } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function StaffLeavePage() {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  const [leave, requests] = await Promise.all([leaveSummary(user.id), getRecentLeaveRequests(user.id)]);

  return (
    <main className="staff-shell">
      <a className="secondary" href="/staff">今日の打刻へ戻る</a>
      {leave.expiring.length > 0 && (
        <section className="card alert">
          <h2>有給の失効予定</h2>
          {leave.expiring.map((grant) => (
            <p key={grant.id}>{grant.expiresAt} までに {minutesToHours(grant.remainingMinutes)} 時間が失効予定です。</p>
          ))}
        </section>
      )}
      <section className="card" id="staff-leave-balance">
        <div className="section-heading">
          <h2>休暇残数</h2>
          <LeaveGrantHistoryModal grants={leave.grants} />
        </div>
        <div className="metric-row">
          <div className="metric"><span>有給</span><strong>{minutesToHours(leave.byType.PAID_LEAVE ?? 0)}h</strong><small>{minutesToHours(leave.byType.PAID_LEAVE ?? 0) / 8}日</small></div>
          <div className="metric"><span>代休</span><strong>{minutesToHours(leave.byType.SUBSTITUTE_HOLIDAY ?? 0)}h</strong><small>{minutesToHours(leave.byType.SUBSTITUTE_HOLIDAY ?? 0) / 8}日</small></div>
          <div className="metric"><span>振休</span><strong>{minutesToHours(leave.byType.COMPENSATORY_HOLIDAY ?? 0)}h</strong><small>{minutesToHours(leave.byType.COMPENSATORY_HOLIDAY ?? 0) / 8}日</small></div>
          <div className="metric"><span>失効注意</span><strong>{leave.expiring.length}件</strong><small>180日以内</small></div>
          <LeaveHistoryModal requests={requests} />
        </div>
      </section>
      <section className="card">
        <h2>休暇申請</h2>
        <PaidLeaveForm />
      </section>
    </main>
  );
}
