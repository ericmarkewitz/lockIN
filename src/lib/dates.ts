/** Dates are handled as local 'YYYY-MM-DD' keys everywhere to avoid timezone drift. */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

/** JS weekday: 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(key: DateKey): number {
  return parseDateKey(key).getDay();
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n); // calendar arithmetic, immune to DST
  return toDateKey(d);
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -((weekdayOf(key) + 6) % 7));
}

export function weekDates(key: DateKey): DateKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function datesInRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Monday-first grid of a month; leading/trailing cells are null. `month` is 0-based. */
export function monthGrid(year: number, month: number): (DateKey | null)[] {
  const first = toDateKey(new Date(year, month, 1));
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (weekdayOf(first) + 6) % 7;
  const cells: (DateKey | null)[] = Array(lead).fill(null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
