/** Mothership-style label from runDate, e.g. AUG W4 */
export function weekLabel(runDate: string): string {
  const d = parseRunDate(runDate);
  if (!d) return "UNKNOWN";
  const month = d
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase();
  const weekOfMonth = Math.ceil(d.getDate() / 7);
  return `${month} W${weekOfMonth}`;
}

export function parseRunDate(runDate: string): Date | null {
  const d = new Date(`${runDate}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isThisWeek(runDate: string, now = new Date()): boolean {
  const d = parseRunDate(runDate);
  if (!d) return false;
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}
