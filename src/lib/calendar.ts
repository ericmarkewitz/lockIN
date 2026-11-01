import { addDays, parseDateKey, startOfWeek, toDateKey, type DateKey } from './dates';

export type ViewMode = 'day' | 'week' | 'month';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const short = (key: DateKey) => `${MONTHS[parseDateKey(key).getMonth()].slice(0, 3)} ${parseDateKey(key).getDate()}`;

export function shiftAnchor(anchor: DateKey, mode: ViewMode, dir: 1 | -1): DateKey {
  if (mode === 'day') return addDays(anchor, dir);
  if (mode === 'week') return addDays(anchor, 7 * dir);
  const d = parseDateKey(anchor);
  const target = new Date(d.getFullYear(), d.getMonth() + dir, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toDateKey(target);
}

export function periodRange(anchor: DateKey, mode: ViewMode): { from: DateKey; to: DateKey } {
  if (mode === 'day') return { from: anchor, to: anchor };
  if (mode === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  const d = parseDateKey(anchor);
  return {
    from: toDateKey(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

export function periodLabel(anchor: DateKey, mode: ViewMode): string {
  const d = parseDateKey(anchor);
  if (mode === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (mode === 'day') return `${DAYS[d.getDay()]}, ${short(anchor)}`;
  const { from, to } = periodRange(anchor, 'week');
  return `${short(from)} – ${short(to)}`;
}

export const DAY_NAMES = DAYS;
