const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export function ageHours(iso) {
  if (!iso) return 168;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / HOUR);
}

export function timeAgo(iso) {
  if (!iso) return "";
  const h = ageHours(iso);
  if (h < 1) return `לפני ${Math.max(1, Math.round(h * 60))} דקות`;
  if (h < 24) return `לפני ${Math.round(h)} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
}

const dateFmt = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" });
const shortFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });
export const longDate = (d = new Date()) => dateFmt.format(d);
export const shortDate = (d) => shortFmt.format(typeof d === "string" ? new Date(d) : d);

export function israelDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jerusalem" }).format(new Date()));
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

// Stable 0..1 from a string, so a dot keeps its place on the radar between renders.
export function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(israelDate(new Date(Date.now() - i * DAY)));
  return out;
}

export function isBlocked(source, blocked) {
  if (!source) return false;
  const s = source.toLowerCase();
  return blocked.some((b) => b && s.includes(b.toLowerCase()));
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
