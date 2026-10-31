// Dates are stored as local calendar days ("YYYY-MM-DD"), never UTC timestamps,
// so a workout logged at 11pm stays on the day you did it.
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** 0 = Monday ... 6 = Sunday */
export const weekdayIndex = (s: string) => (parseISO(s).getDay() + 6) % 7;

/** The date of the given weekday (0 = Monday) in the current Mon–Sun week. */
export const dateForWeekday = (idx: number) => {
  const t = new Date();
  t.setDate(t.getDate() + (idx - ((t.getDay() + 6) % 7)));
  return toISO(t);
};

export const formatLong = (s: string) =>
  parseISO(s).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
