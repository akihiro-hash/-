"use client";

type StaffOption = {
  id: string;
  name: string;
};

type Props = {
  users: StaffOption[];
  jobTitles: string[];
};

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const safeValue = Math.max(0, Math.min(23 * 60 + 59, value));
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function calculateEndTime(start: string, weeklyDays: number, weeklyHours: number) {
  const dailyMinutes = Math.round((weeklyHours / Math.max(1, weeklyDays)) * 60);
  const breakMinutes = dailyMinutes >= 6 * 60 ? 60 : 0;
  return minutesToTime(timeToMinutes(start) + dailyMinutes + breakMinutes);
}

export function StaffSettingsForm({ users, jobTitles }: Props) {
  function syncEndTime(form: HTMLFormElement) {
    const weeklyDays = form.elements.namedItem("weeklyWorkDays") as HTMLInputElement | null;
    const weeklyHours = form.elements.namedItem("weeklyWorkHours") as HTMLInputElement | null;
    const startTime = form.elements.namedItem("standardStartTime") as HTMLInputElement | null;
    const endTime = form.elements.namedItem("standardEndTime") as HTMLInputElement | null;
    if (!weeklyDays || !weeklyHours || !startTime || !endTime) return;
    endTime.value = calculateEndTime(startTime.value || "09:00", Number(weeklyDays.value || 5), Number(weeklyHours.value || 40));
  }

  return (
    <form className="admin-actions" action="/api/admin/staff-settings" method="post">
      <label>
        スタッフ
        <select name="userId" required>
          {users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}
        </select>
      </label>
      <label>
        適用開始日
        <input name="effectiveFrom" type="date" required />
      </label>
      <label>
        部署
        <input name="department" placeholder="例: 訪問看護" />
      </label>
      <label>
        職種
        <select name="jobTitle" defaultValue="その他">
          {jobTitles.map((jobTitle) => <option value={jobTitle} key={jobTitle}>{jobTitle}</option>)}
        </select>
      </label>
      <label>
        週所定日数
        <input name="weeklyWorkDays" type="number" min="1" max="7" step="1" defaultValue="5" required onChange={(event) => syncEndTime(event.currentTarget.form)} />
      </label>
      <label>
        週所定時間
        <input name="weeklyWorkHours" type="number" min="1" step="0.5" defaultValue="40" required onChange={(event) => syncEndTime(event.currentTarget.form)} />
      </label>
      <label>
        標準出勤
        <input name="standardStartTime" type="time" defaultValue="09:00" required onChange={(event) => syncEndTime(event.currentTarget.form)} />
      </label>
      <label>
        標準退勤
        <input name="standardEndTime" type="time" defaultValue="18:00" required />
      </label>
      <button className="primary">設定を保存</button>
    </form>
  );
}
