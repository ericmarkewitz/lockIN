/**
 * SQL condition for a set the user logged: ticked off, or with any value entered.
 * Every feature uses this one rule. The query must alias the `sets` table as `s`.
 */
export const LOGGED_SET =
  '(s.completed = 1 OR s.reps IS NOT NULL OR s.weight IS NOT NULL OR s.duration_min IS NOT NULL OR s.distance IS NOT NULL)';
