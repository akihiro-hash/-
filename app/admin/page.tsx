import { AdminDecisionButtons, PrintButton } from "@/components/AdminActions";
import { AdminHelpModal } from "@/components/AdminHelpModal";
import { StaffSettingsForm } from "@/components/StaffSettingsForm";
import { requireAdmin } from "@/lib/auth";
import { getMonthData, getWorkingWeekdaySettings, isScheduledWorkday, leaveSummary } from "@/lib/json-db";
import { formatTime, minutesToHours, monthRange, toJstDateKey } from "@/lib/time";
import { getJpHolidayName } from "@/lib/jp-holidays";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string; saved?: string }>;
};

const statusLabels: Record<string, string> = {
  NORMAL: "出",
  LATE: "遅",
  EARLY_LEAVE: "早",
  ABSENT: "欠",
  PAID_LEAVE: "有",
  MISSING_CLOCK: "漏",
  PENDING: "-"
};

const leaveLabels: Record<string, string> = {
  PAID_LEAVE: "有給",
  COMPENSATORY_HOLIDAY: "振休",
  SUBSTITUTE_HOLIDAY: "代休",
  ABSENCE: "欠勤",
  SPECIAL_LEAVE: "特休"
};

const unitLabels: Record<string, string> = {
  FULL_DAY: "全日",
  HALF_DAY: "半日",
  HOURLY: "時間"
};

const halfDayLabels: Record<string, string> = {
  AM: "午前",
  PM: "午後"
};

const requestStatusLabels: Record<string, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済み",
  REJECTED: "却下"
};

const jobTitles = ["看護師", "理学療法士", "作業療法士", "言語聴覚士", "その他"];

const savedMessages: Record<string, string> = {
  "staff-added": "スタッフを追加しました。",
  "staff-settings": "スタッフ勤務設定を保存しました。",
  "month-closed": "月末締めを完了しました。",
  "password-reset": "仮パスワード password123 にリセットしました。本人に伝えて、ログイン後に変更してもらってください。"
};

type LeaveRequestLike = {
  leaveType: string;
  unit: string;
  halfDayPeriod?: "AM" | "PM" | null;
};

function formatLeaveRequestLabel(request: LeaveRequestLike, short = false) {
  const leave = leaveLabels[request.leaveType] ?? request.leaveType;
  if (request.unit === "HALF_DAY") {
    const period = halfDayLabels[request.halfDayPeriod ?? ""] ?? "半日";
    if (short && request.leaveType === "PAID_LEAVE") return `${period}有`;
    return `${period}${leave}`;
  }
  if (short) return leave;
  return `${unitLabels[request.unit] ?? request.unit}${leave}`;
}

export default async function AdminPage({ searchParams }: Props) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const month = params.month ?? toJstDateKey().slice(0, 7);
  const { days } = monthRange(month);
  const { users, allStaffUsers, records, leaves, correctionRequests, leaveRequests, correctionLogs, leaveRequestHistory, paidLeaveGrants, auditLogs, monthClosed } = await getMonthData(month);
  const [expiringSummaries, workingWeekdaySettings] = await Promise.all([
    Promise.all(users.map(async (user) => ({ user, summary: await leaveSummary(user.id) }))),
    getWorkingWeekdaySettings(users.map((user) => user.id))
  ]);
  const userName = new Map(users.map((user) => [user.id, user.name]));
  const recordMap = new Map(records.map((record) => [`${record.userId}:${record.workDate}`, record]));
  const todayKey = toJstDateKey();
  const overtimeByUser = new Map<string, number>();
  for (const record of records) {
    overtimeByUser.set(record.userId, (overtimeByUser.get(record.userId) ?? 0) + record.overtimeMins);
  }
  const leaveMap = new Map<string, typeof leaves>();

  for (const leave of leaves) {
    const key = `${leave.userId}:${leave.startAt.slice(0, 10)}`;
    leaveMap.set(key, [...(leaveMap.get(key) ?? []), leave]);
  }
  const missingAlerts = users.flatMap((user) =>
    Array.from({ length: days }, (_, index) => {
      const dateKey = `${month}-${String(index + 1).padStart(2, "0")}`;
      if (dateKey >= todayKey) return null;
      if (!isScheduledWorkday(user, dateKey, workingWeekdaySettings) || getJpHolidayName(dateKey)) return null;
      const record = recordMap.get(`${user.id}:${dateKey}`);
      if (!record) return { user, dateKey, message: "勤怠未登録" };
      if (record.clockInAt && !record.clockOutAt) return { user, dateKey, message: "退勤漏れ" };
      return null;
    }).filter((item): item is { user: typeof user; dateKey: string; message: string } => !!item)
  );
  const missingAlertsByUser = new Map<string, { user: (typeof users)[number]; items: typeof missingAlerts }>();
  for (const alert of missingAlerts) {
    const current = missingAlertsByUser.get(alert.user.id);
    if (current) {
      current.items.push(alert);
    } else {
      missingAlertsByUser.set(alert.user.id, { user: alert.user, items: [alert] });
    }
  }
  const holidayWorkCandidates = records
    .filter((record) => {
      if (!record.clockInAt) return false;
      const weekday = new Date(`${record.workDate}T00:00:00+09:00`).getDay();
      return weekday === 0 || weekday === 6 || !!getJpHolidayName(record.workDate);
    })
    .map((record) => ({ record, user: users.find((user) => user.id === record.userId), holiday: getJpHolidayName(record.workDate) }));
  const holidayWorkByUser = new Map<string, { userName: string; items: typeof holidayWorkCandidates }>();
  for (const candidate of holidayWorkCandidates) {
    const key = candidate.user?.id ?? candidate.record.userId;
    const current = holidayWorkByUser.get(key);
    if (current) {
      current.items.push(candidate);
    } else {
      holidayWorkByUser.set(key, { userName: candidate.user?.name ?? "スタッフ", items: [candidate] });
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar no-print">
        <div>
          <p className="eyebrow">管理者</p>
          <h1>月次勤怠一覧</h1>
          <p className="muted">{admin.name} / {month}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="secondary">ログアウト</button>
        </form>
      </header>

      <section className="card no-print">
        <form className="admin-actions" action="/admin">
          <label>
            対象月
            <input type="month" name="month" defaultValue={month} />
          </label>
          <button className="primary">表示</button>
          <a className="secondary" href={`/api/admin/export.csv?month=${month}`}>CSV出力</a>
          <a className="secondary" href={`/api/admin/export.xls?month=${month}`}>Excel出力</a>
          <PrintButton />
          <AdminHelpModal />
        </form>
      </section>

      <section className="card no-print">
        <div className="section-heading">
          <div>
            <h2>月末締め</h2>
            <p className="muted">{monthClosed ? `${month} は締め済みです。スタッフ側からの修正・申請は止まります。` : "確認が終わった月は締めると、スタッフ側からの後追い修正を防げます。"}</p>
          </div>
          {!monthClosed && (
            <form action="/api/admin/month-close" method="post">
              <input type="hidden" name="month" value={month} />
              <button className="danger">この月を締める</button>
            </form>
          )}
        </div>
      </section>

      {params.saved && savedMessages[params.saved] && (
        <section className="card success-note no-print">
          {savedMessages[params.saved]}
        </section>
      )}

      {(leaveRequests.length > 0 || correctionRequests.length > 0) && (
        <section className="card alert no-print">
          <h2>未承認があります</h2>
          <p>休み申請 {leaveRequests.length}件 / 勤怠修正 {correctionRequests.length}件 が承認待ちです。</p>
        </section>
      )}

      {missingAlerts.length > 0 && (
        <section className="card alert no-print">
          <h2>未打刻・退勤漏れアラート</h2>
          <p>{missingAlerts.length}件あります。スタッフごとに確認できます。</p>
          <div className="alert-group-list">
            {[...missingAlertsByUser.values()].map(({ user, items }) => (
              <details className="day-item alert-detail" key={user.id}>
                <summary>
                  <strong>{user.name}</strong>
                  <span>{items.length}件</span>
                </summary>
                <div className="detail-body">
                  {items.map((item) => (
                    <span key={`${item.user.id}:${item.dateKey}`}>{item.dateKey} / {item.message}</span>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {holidayWorkCandidates.length > 0 && (
        <section className="card alert no-print">
          <h2>休日出勤候補</h2>
          <p>土日祝の出勤が {holidayWorkCandidates.length}件あります。代休付与が必要か確認してください。</p>
          <div className="alert-group-list">
            {[...holidayWorkByUser.entries()].map(([userId, group]) => (
              <details className="day-item alert-detail" key={userId}>
                <summary>
                  <strong>{group.userName}</strong>
                  <span>{group.items.length}件</span>
                </summary>
                <div className="detail-body">
                  {group.items.map(({ record, holiday }) => (
                    <span key={record.id}>{record.workDate} {holiday ? `/ ${holiday}` : "/ 土日"} / 出勤 {formatTime(record.clockInAt ? new Date(record.clockInAt) : null)}</span>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {expiringSummaries.some((item) => item.summary.expiring.length > 0) && (
        <section className="card alert no-print">
          <h2>有給失効アラート</h2>
          <div className="day-list">
            {expiringSummaries.flatMap(({ user, summary }) =>
              summary.expiring.map((grant) => (
                <div className="day-item" key={grant.id}>
                  <strong>{user.name}</strong>
                  <span>{grant.expiresAt} までに {minutesToHours(grant.remainingMinutes)}h が失効予定</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {[...overtimeByUser.entries()].some(([, minutes]) => minutes >= 15 * 60) && (
        <section className="card alert no-print">
          <h2>残業アラート</h2>
          <div className="day-list">
            {[...overtimeByUser.entries()]
              .filter(([, minutes]) => minutes >= 15 * 60)
              .map(([userId, minutes]) => (
                <div className="day-item overtime-alert" key={userId}>
                  <strong>{userName.get(userId)}</strong>
                  <span>今月の残業が {minutesToHours(minutes)}h です。みなし20hに近づいています。</span>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>{month} 全スタッフ勤怠</h2>
        <div className="table-wrap">
          <table className="monthly-table">
            <thead>
              <tr>
                <th className="staff-col">スタッフ</th>
                {Array.from({ length: days }, (_, index) => <th key={index + 1}>{index + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <th className="staff-col">
                    {user.name}
                    <br />
                    <span className="muted">{user.department} / {user.jobTitle ?? "その他"}</span>
                    {user.employmentStatus !== "ACTIVE" && (
                      <>
                        <br />
                        <span className="muted">退職日 {user.retirementDate ?? "-"}</span>
                      </>
                    )}
                    {(overtimeByUser.get(user.id) ?? 0) >= 15 * 60 && (
                      <span className="overtime-alert-text"> 残{minutesToHours(overtimeByUser.get(user.id) ?? 0)}h</span>
                    )}
                  </th>
                  {Array.from({ length: days }, (_, index) => {
                    const dateKey = `${month}-${String(index + 1).padStart(2, "0")}`;
                    const record = recordMap.get(`${user.id}:${dateKey}`);
                    const weekday = new Date(`${dateKey}T00:00:00+09:00`).getDay();
                    const isHolidayWork = !!record?.clockInAt && (weekday === 0 || weekday === 6 || !!getJpHolidayName(dateKey));
                    const cellLeaves = leaveMap.get(`${user.id}:${dateKey}`) ?? [];
                    const approvedLeave = cellLeaves.find((leave) => leave.status === "APPROVED");
                    const pendingLeave = cellLeaves.find((leave) => leave.status === "PENDING");
                    const label = approvedLeave ? formatLeaveRequestLabel(approvedLeave, true) : pendingLeave ? "申請" : record ? statusLabels[record.status] : "";
                    const className = isHolidayWork
                      ? "status-holiday-work"
                      : record?.onCall
                      ? "status-oncall"
                      : approvedLeave
                      ? approvedLeave.leaveType === "ABSENCE" ? "status-absence" : "status-leave"
                      : pendingLeave
                        ? "status-pending"
                        : record?.status === "NORMAL"
                          ? "status-normal"
                          : record?.status === "MISSING_CLOCK"
                            ? "status-missing"
                            : "";
                    const tooltipTarget = approvedLeave ?? pendingLeave;
                    return (
                      <td key={dateKey} className={className} tabIndex={tooltipTarget ? 0 : undefined}>
                        {label}
                        {record?.clockInAt && (
                          <span className="muted">
                            <br />
                            {formatTime(new Date(record.clockInAt))}
                          </span>
                        )}
                        {record && record.emergencyVisits > 0 && (
                          <span className="visit-count">{record.emergencyVisits}</span>
                        )}
                        {tooltipTarget && (
                          <span className="tooltip">
                            {formatLeaveRequestLabel(tooltipTarget)} / {tooltipTarget.status}
                            <br />
                            {tooltipTarget.reason}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card no-print">
        <h2>代休付与</h2>
        <p className="muted">土日祝に出勤があった場合など、管理者が代休を付与するための記録です。</p>
        <form className="admin-actions" action="/api/admin/compensatory-grants" method="post">
          <label>
            スタッフ
            <select name="userId" required>
              {users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}
            </select>
          </label>
          <label>
            休日出勤日
            <input name="workedDate" type="date" required />
          </label>
          <label>
            代休付与日
            <input name="grantDate" type="date" />
          </label>
          <label>
            付与日数
            <input name="grantedDays" type="number" min="0" step="0.5" defaultValue="1" required />
          </label>
          <button className="primary">代休を付与</button>
        </form>
      </section>

      <details className="card accordion-card no-print">
        <summary className="accordion-summary">有給付与履歴</summary>
        <div className="accordion-body">
        <div className="request-list">
          {paidLeaveGrants
            .slice()
            .sort((a, b) => b.grantDate.localeCompare(a.grantDate))
            .map((grant) => (
              <div className="request-item" key={grant.id}>
                <div>
                  <strong>{userName.get(grant.userId)} / {grant.grantDate} 付与</strong>
                  <p className="muted">
                    種別 {leaveLabels[grant.leaveType ?? "PAID_LEAVE"] ?? "有給"} / 付与 {minutesToHours(grant.grantedMinutes) / 8}日 / 残 {minutesToHours(grant.remainingMinutes) / 8}日 / 失効 {grant.expiresAt} / {grant.note}
                  </p>
                </div>
              </div>
            ))}
          {paidLeaveGrants.length === 0 && <p className="muted">有給付与履歴はありません。</p>}
        </div>
        </div>
      </details>

      <section className="card no-print">
        <h2>オンコール・緊急訪問の修正</h2>
        <form className="admin-actions" action="/api/admin/daily-operations" method="post">
          <label>
            スタッフ
            <select name="userId" required>
              {users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}
            </select>
          </label>
          <label>
            対象日
            <input name="targetDate" type="date" required />
          </label>
          <label className="check-row admin-check">
            <input name="onCall" type="checkbox" />
            <span>オンコール</span>
          </label>
          <label>
            緊急訪問回数
            <input name="emergencyVisits" type="number" min="0" step="1" defaultValue="0" />
          </label>
          <button className="primary">保存</button>
        </form>
      </section>

      <section className="card no-print">
        <h2>管理者による出退勤修正</h2>
        <form className="admin-actions" action="/api/admin/attendance-corrections" method="post">
          <label>
            スタッフ
            <select name="userId" required>
              {users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}
            </select>
          </label>
          <label>
            対象日
            <input name="targetDate" type="date" required />
          </label>
          <label>
            出勤
            <input name="clockIn" type="time" required />
          </label>
          <label>
            退勤
            <input name="clockOut" type="time" required />
          </label>
          <label>
            理由
            <input name="reason" defaultValue="管理者修正" required />
          </label>
          <button className="primary">修正を保存</button>
        </form>
      </section>

      <details className="card accordion-card no-print">
        <summary className="accordion-summary">修正ログ</summary>
        <div className="accordion-body">
        <div className="request-list">
          {correctionLogs.slice().reverse().map((log) => (
            <div className="request-item" key={log.id}>
              <div>
                <strong>{userName.get(log.userId)} / {log.targetDate} / {log.actorRole === "ADMIN" ? "管理者" : "スタッフ"}修正</strong>
                <p className="muted">
                  {formatTime(log.beforeClockInAt ? new Date(log.beforeClockInAt) : null) || "--:--"}-{formatTime(log.beforeClockOutAt ? new Date(log.beforeClockOutAt) : null) || "--:--"}
                  {" -> "}
                  {formatTime(log.afterClockInAt ? new Date(log.afterClockInAt) : null) || "--:--"}-{formatTime(log.afterClockOutAt ? new Date(log.afterClockOutAt) : null) || "--:--"}
                  {" / "}{log.reason}
                </p>
              </div>
            </div>
          ))}
          {correctionLogs.length === 0 && <p className="muted">今月の修正ログはありません。</p>}
        </div>
        </div>
      </details>

      <details className="card accordion-card no-print">
        <summary className="accordion-summary">監査ログ</summary>
        <div className="accordion-body">
          <div className="request-list">
            {auditLogs.map((log) => (
              <div className="request-item" key={log.id}>
                <div>
                  <strong>{log.action} / {log.entityType}</strong>
                  <p className="muted">
                    {formatTime(log.createdAt ? new Date(log.createdAt) : null)} / 操作者 {log.actorId ? userName.get(log.actorId) ?? "管理者" : "システム"} / 対象 {log.entityId ?? "-"}
                  </p>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="muted">監査ログはまだありません。</p>}
          </div>
        </div>
      </details>

      <details className="card accordion-card no-print">
        <summary className="accordion-summary">休み申請の記録</summary>
        <div className="accordion-body">
        <div className="request-list">
          {leaveRequestHistory
            .slice()
            .reverse()
            .map((request) => (
              <div className="request-item" key={request.id}>
                <div>
                  <strong>{userName.get(request.userId)} / {formatLeaveRequestLabel(request)}</strong>
                  <p className="muted">
                    {request.startAt.slice(0, 10)} / {requestStatusLabels[request.status] ?? request.status} / {minutesToHours(request.requestedMinutes)}h / {request.reason}
                  </p>
                </div>
                {request.status === "PENDING" && (
                  <AdminDecisionButtons
                    approveEndpoint={`/api/admin/paid-leave-requests/${request.id}/approve`}
                    rejectEndpoint={`/api/admin/paid-leave-requests/${request.id}/reject`}
                  />
                )}
              </div>
            ))}
          {leaveRequestHistory.length === 0 && <p className="muted">この月の休み申請はありません。</p>}
        </div>
        </div>
      </details>

      <section className="card no-print">
        <h2>承認待ち</h2>
        <div className="request-list">
          {leaveRequests.map((request) => (
            <div className="request-item" key={request.id}>
              <div>
                <strong>{userName.get(request.userId)} / {formatLeaveRequestLabel(request)}</strong>
                <p className="muted">
                  {request.startAt.slice(0, 10)} {minutesToHours(request.requestedMinutes)}h / {request.reason}
                </p>
              </div>
              <AdminDecisionButtons
                approveEndpoint={`/api/admin/paid-leave-requests/${request.id}/approve`}
                rejectEndpoint={`/api/admin/paid-leave-requests/${request.id}/reject`}
              />
            </div>
          ))}
          {correctionRequests.map((request) => (
            <div className="request-item" key={request.id}>
              <div>
                <strong>{userName.get(request.userId)} / 勤怠修正</strong>
                <p className="muted">
                  {request.targetDate} {formatTime(request.requestedClockInAt ? new Date(request.requestedClockInAt) : null)} - {formatTime(request.requestedClockOutAt ? new Date(request.requestedClockOutAt) : null)} / {request.reason}
                </p>
              </div>
              <AdminDecisionButtons
                approveEndpoint={`/api/admin/correction-requests/${request.id}/approve`}
                rejectEndpoint={`/api/admin/correction-requests/${request.id}/reject`}
              />
            </div>
          ))}
          {leaveRequests.length === 0 && correctionRequests.length === 0 && <p className="muted">承認待ちはありません。</p>}
        </div>
      </section>

      <section className="card no-print">
        <h2>スタッフ管理</h2>
        <p className="muted">新規スタッフの追加と、既存スタッフの勤務条件変更をここで管理します。</p>

        <details className="accordion-card" open>
          <summary className="accordion-summary">新規スタッフを追加</summary>
          <div className="accordion-body">
            <p className="muted">初期パスワードは全員 `password123` です。</p>
            <form className="admin-actions" action="/api/admin/staff" method="post">
              <label>
                氏名
                <input name="name" required />
              </label>
              <label>
                メール
                <input name="email" type="email" required />
              </label>
              <label>
                職種
                <select name="jobTitle" defaultValue="看護師">
                  {jobTitles.map((jobTitle) => <option value={jobTitle} key={jobTitle}>{jobTitle}</option>)}
                </select>
              </label>
              <label>
                雇用形態
                <select name="employmentType" defaultValue="正社員">
                  <option value="正社員">正社員</option>
                  <option value="パート">パート</option>
                  <option value="時短">時短</option>
                  <option value="非常勤">非常勤</option>
                  <option value="その他">その他</option>
                </select>
              </label>
              <label>
                部署
                <input name="department" defaultValue="訪問看護" required />
              </label>
              <label>
                入社日
                <input name="hireDate" type="date" required />
              </label>
              <label>
                週所定日数
                <input name="weeklyWorkDays" type="number" min="1" max="7" step="1" defaultValue="5" required />
              </label>
              <fieldset className="weekday-picker">
                <legend>勤務曜日</legend>
                {[
                  ["1", "月"],
                  ["2", "火"],
                  ["3", "水"],
                  ["4", "木"],
                  ["5", "金"],
                  ["6", "土"],
                  ["0", "日"]
                ].map(([value, label]) => (
                  <label className="check-row weekday-check" key={value}>
                    <input name="workingWeekdays" type="checkbox" value={value} defaultChecked={["1", "2", "3", "4", "5"].includes(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                週所定時間
                <input name="weeklyWorkHours" type="number" min="1" step="0.5" defaultValue="40" required />
              </label>
              <button className="primary">スタッフを追加</button>
            </form>
          </div>
        </details>

        <details className="accordion-card">
          <summary className="accordion-summary">既存スタッフの勤務設定を変更</summary>
          <div className="accordion-body">
            <p className="muted">パートさんなど、週の所定労働日数・時間を適用開始日つきで設定します。有給の自動付与は付与日時点の設定で計算します。</p>
            <StaffSettingsForm users={allStaffUsers.map((user) => ({ id: user.id, name: user.employmentStatus === "ACTIVE" ? user.name : `${user.name}（退職）` }))} jobTitles={jobTitles} />
          </div>
        </details>

        <details className="accordion-card">
          <summary className="accordion-summary">パスワード緊急リセット</summary>
          <div className="accordion-body">
            <p className="muted">本人がパスワードを忘れた場合に、仮パスワード password123 に戻します。ログイン後、本人にパスワード変更してもらってください。</p>
            <form className="admin-actions" action="/api/admin/password-reset" method="post">
              <label>
                スタッフ
                <select name="userId" required>
                  {users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}
                </select>
              </label>
              <button className="danger">仮パスワードに戻す</button>
            </form>
          </div>
        </details>
      </section>
    </main>
  );
}
