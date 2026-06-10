const JST_OFFSET_MINS = 9 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toJstDateKey(value = new Date()) {
  const jst = new Date(value.getTime() + JST_OFFSET_MINS * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function parseJstDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

export function getJstWeekday(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return 0;
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return Number.isFinite(weekday) ? weekday : 0;
}

export function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1) - JST_OFFSET_MINS * 60 * 1000);
  const end = new Date(Date.UTC(year, month, 1) - JST_OFFSET_MINS * 60 * 1000);
  return { start, end, days: new Date(year, month, 0).getDate() };
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addYears(date: Date, years: number) {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

export function formatTime(value?: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo"
  }).format(value);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo"
  }).format(value);
}

export function requestedLeaveMinutes(unit: string, hours?: number) {
  if (unit === "FULL_DAY") return 8 * 60;
  if (unit === "HALF_DAY") return 4 * 60;
  return Math.max(1, Math.round((hours ?? 1) * 60));
}
