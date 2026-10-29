export const DEFAULT_TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (v: number | null | undefined) => brl.format(Number(v ?? 0));

export function formatDate(iso: string | Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
export function formatTime(iso: string | Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
export function formatDateTime(iso: string | Date, tz = DEFAULT_TZ) {
  return `${formatDate(iso, tz)} ${formatTime(iso, tz)}`;
}

/** Offset in minutes of tz at the given instant (e.g. -180 for São Paulo). */
function tzOffsetMin(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Convert a local wall-clock date ("2026-10-28") + time ("14:30") in tz to an ISO instant. */
export function zonedToISO(date: string, time: string, tz = DEFAULT_TZ) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = tzOffsetMin(guess, tz);
  return new Date(guess.getTime() - off * 60000).toISOString();
}

/** Local YYYY-MM-DD for an instant in tz. */
export function isoDateInTz(iso: string | Date, tz = DEFAULT_TZ) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p;
}
export function timeInTz(iso: string | Date, tz = DEFAULT_TZ) {
  return formatTime(iso, tz);
}
export function todayInTz(tz = DEFAULT_TZ) {
  return isoDateInTz(new Date(), tz);
}
export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
/** Range [start, end) of a local day in tz as ISO instants. */
export function dayRange(date: string, tz = DEFAULT_TZ) {
  return { from: zonedToISO(date, "00:00", tz), to: zonedToISO(addDays(date, 1), "00:00", tz) };
}
export function weekStart(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return addDays(date, -((dow + 6) % 7)); // segunda
}
export function formatDayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
}
export function addMinutesToTime(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const t = (h * 60 + m + mins) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
export const onlyDigits = (s: string) => s.replace(/\D/g, "");
export function formatPhone(p: string) {
  const d = onlyDigits(p);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}
