"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getJpHolidayName } from "@/lib/jp-holidays";
import { getJstWeekday } from "@/lib/time";

function useSubmit() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(endpoint: string, form: HTMLFormElement, successMessage: string) {
    setPending(true);
    const response = await fetch(endpoint, { method: "POST", body: new FormData(form) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      alert(payload?.error ?? "申請に失敗しました。");
    } else {
      form.reset();
      setMessage(successMessage);
      window.setTimeout(() => setMessage(null), 2600);
      router.refresh();
    }
    setPending(false);
  }
  return { pending, submit, message };
}

export function PaidLeaveForm() {
  const { pending, submit, message } = useSubmit();
  const [unit, setUnit] = useState("FULL_DAY");
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); submit("/api/paid-leave-requests", event.currentTarget, "休暇申請を送信しました"); setUnit("FULL_DAY"); }}>
      {message && <p className="success-note">{message}</p>}
      <div className="metric-row">
        <label>
          種別
          <select name="leaveType" defaultValue="PAID_LEAVE">
            <option value="PAID_LEAVE">有給</option>
            <option value="COMPENSATORY_HOLIDAY">振休</option>
            <option value="SUBSTITUTE_HOLIDAY">代休</option>
            <option value="ABSENCE">欠勤</option>
            <option value="SPECIAL_LEAVE">特別休暇</option>
          </select>
        </label>
        <label>
          単位
          <select name="unit" value={unit} onChange={(event) => setUnit(event.target.value)}>
            <option value="FULL_DAY">全日</option>
            <option value="HALF_DAY">半日</option>
            <option value="HOURLY">時間</option>
          </select>
        </label>
        {unit === "HALF_DAY" && (
          <label>
            午前/午後
            <select name="halfDayPeriod" defaultValue="AM">
              <option value="AM">午前</option>
              <option value="PM">午後</option>
            </select>
          </label>
        )}
        <label>
          時間
          <input name="hours" type="number" min="1" max="8" step="0.5" defaultValue="1" disabled={unit !== "HOURLY"} />
        </label>
      </div>
      <div className="metric-row">
        <label>
          開始日
          <input name="startDate" type="date" required />
        </label>
        <label>
          終了日
          <input name="endDate" type="date" />
        </label>
      </div>
      <label>
        理由
        <textarea name="reason" placeholder="例: 私用のため" />
      </label>
      <button className="primary" disabled={pending}>{pending ? "申請中..." : "休暇を申請"}</button>
    </form>
  );
}

export function CorrectionForm() {
  const { pending, submit, message } = useSubmit();
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); submit("/api/correction-requests", event.currentTarget, "勤怠修正を申請しました"); }}>
      {message && <p className="success-note">{message}</p>}
      <label>
        対象日
        <input name="targetDate" type="date" required />
      </label>
      <div className="metric-row">
        <label>
          出勤
          <input name="clockIn" type="time" />
        </label>
        <label>
          退勤
          <input name="clockOut" type="time" />
        </label>
      </div>
      <label>
        理由
        <textarea name="reason" required placeholder="例: 打刻漏れのため" />
      </label>
      <button className="secondary" disabled={pending}>{pending ? "申請中..." : "勤怠修正を申請"}</button>
    </form>
  );
}

export function DirectAttendanceCorrectionForm({
  month,
  days,
  registeredDates,
  dayOperations,
  standardWorkByDate,
  defaultStandardWork
}: {
  month: string;
  days: number;
  registeredDates: string[];
  dayOperations: Record<string, { onCall: boolean; emergencyVisits: number }>;
  standardWorkByDate: Record<string, { start: string; end: string; label: string }>;
  defaultStandardWork: { start: string; end: string; label: string };
}) {
  const { pending, submit, message } = useSubmit();
  const registered = new Set(registeredDates);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const firstWeekday = getJstWeekday(`${month}-01`);
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); submit("/api/attendance-corrections", event.currentTarget, "出退勤と日次情報を修正しました"); }}>
      {message && <p className="success-note">{message}</p>}
      <label>
        対象日
        <input name="targetDate" type="date" required />
      </label>
      <div className="mini-calendar" aria-label="勤怠登録状況">
        {weekdays.map((weekday) => (
          <div className="weekday-cell" key={weekday}>{weekday}</div>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <div className="date-spacer" key={`spacer-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const dateKey = `${month}-${String(day).padStart(2, "0")}`;
          const isRegistered = registered.has(dateKey);
          const weekday = getJstWeekday(dateKey);
          const holiday = getJpHolidayName(dateKey);
          return (
            <button
              className={`${isRegistered ? "date-chip registered" : "date-chip unregistered"} ${weekday === 0 ? "sunday" : ""} ${weekday === 6 ? "saturday" : ""} ${holiday ? "holiday" : ""}`}
              key={dateKey}
              type="button"
              onClick={(event) => setCorrectionDate(event.currentTarget.form, dateKey, dayOperations[dateKey])}
              title={`${isRegistered ? "登録済み" : "未登録"}${holiday ? ` / ${holiday}` : ""}`}
            >
              <span>{day}</span>
              {holiday && <small>祝</small>}
            </button>
          );
        })}
      </div>
      <p className="muted">日付を押すと対象日に入ります。緑は登録済み、薄赤は未登録、赤枠は日曜・祝日です。</p>
      <div className="quick-time-grid">
        <button className="secondary" type="button" onClick={(event) => fillCorrectionTimesForSelectedDate(event.currentTarget.form, standardWorkByDate, defaultStandardWork)}>
          勤務設定 {defaultStandardWork.label}
        </button>
      </div>
      <div className="metric-row">
        <label>
          出勤
          <input name="clockIn" type="time" required />
        </label>
        <label>
          退勤
          <input name="clockOut" type="time" required />
        </label>
      </div>
      <label className="check-row">
        <input name="onCall" type="checkbox" />
        <span>この日はオンコール当番</span>
      </label>
      <label>
        緊急訪問回数
        <input name="emergencyVisits" type="number" min="0" step="1" defaultValue="0" />
      </label>
      <label>
        修正理由
        <textarea name="reason" placeholder="空欄でも保存できます" />
      </label>
      <button className="secondary" disabled={pending}>{pending ? "保存中..." : "当月の出退勤を修正"}</button>
    </form>
  );
}

function setCorrectionDate(form: HTMLFormElement | null, dateKey: string, operations?: { onCall: boolean; emergencyVisits: number }) {
  if (!form) return;
  const dateInput = form.elements.namedItem("targetDate") as HTMLInputElement | null;
  const onCallInput = form.elements.namedItem("onCall") as HTMLInputElement | null;
  const visitsInput = form.elements.namedItem("emergencyVisits") as HTMLInputElement | null;
  if (dateInput) dateInput.value = dateKey;
  if (onCallInput) onCallInput.checked = operations?.onCall ?? false;
  if (visitsInput) visitsInput.value = String(operations?.emergencyVisits ?? 0);
}

function fillCorrectionTimes(form: HTMLFormElement | null, clockIn: string, clockOut: string) {
  if (!form) return;
  const inInput = form.elements.namedItem("clockIn") as HTMLInputElement | null;
  const outInput = form.elements.namedItem("clockOut") as HTMLInputElement | null;
  if (inInput) inInput.value = clockIn;
  if (outInput) outInput.value = clockOut;
}

function fillCorrectionTimesForSelectedDate(
  form: HTMLFormElement | null,
  standardWorkByDate: Record<string, { start: string; end: string; label: string }>,
  fallback: { start: string; end: string; label: string }
) {
  if (!form) return;
  const dateInput = form.elements.namedItem("targetDate") as HTMLInputElement | null;
  const standard = dateInput?.value ? standardWorkByDate[dateInput.value] ?? fallback : fallback;
  fillCorrectionTimes(form, standard.start, standard.end);
}

export function DailyOperationsForm({ onCall, yesterdayVisits }: { onCall: boolean; yesterdayVisits: number }) {
  const { pending, submit, message } = useSubmit();
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); submit("/api/daily-operations", event.currentTarget, "オンコール・訪問回数を保存しました"); }}>
      {message && <p className="success-note">{message}</p>}
      <label className="check-row">
        <input name="onCall" type="checkbox" defaultChecked={onCall} />
        <span>今日はオンコール当番</span>
      </label>
      <label>
        昨日の緊急訪問回数
        <input name="emergencyVisits" type="number" min="0" step="1" defaultValue={yesterdayVisits} />
      </label>
      <p className="muted">緊急訪問回数は翌日入力する想定のため、昨日分に反映されます。</p>
      <button className="secondary" disabled={pending}>{pending ? "保存中..." : "オンコール・訪問回数を保存"}</button>
    </form>
  );
}
