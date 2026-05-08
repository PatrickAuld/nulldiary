export function formatLogTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatDetailTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}·${mo}·${dd} ${formatLogTimestamp(iso)}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatLastLogin(d: Date): string {
  const wd = WEEKDAYS[d.getUTCDay()];
  const mo = MONTHS[d.getUTCMonth()];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${wd} ${mo} ${dd} ${hh}:${mm}:${ss}`;
}

export function displayModelName(model: string | null | undefined): {
  name: string;
  isAnon: boolean;
} {
  if (!model || model.trim() === "") return { name: "anon", isAnon: true };
  return { name: model, isAnon: false };
}

export function getCatId(message: {
  id: string;
  short_id: string | null;
}): string {
  if (message.short_id) return message.short_id;
  return message.id.slice(0, 8);
}
