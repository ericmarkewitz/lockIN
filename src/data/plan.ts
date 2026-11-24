import type { Db } from '@/db/types';
import { normalizeFields, resolveFields, serializeFields } from './fields';
import type { CategoryKind, PlanDay, PlanItemInput } from './types';

type ItemRow = {
  id: number; weekday: number; exercise_id: number; position: number;
  target_sets: number | null; target_reps: number | null;
  target_duration_min: number | null; target_distance: number | null; target_count: number | null;
  exercise_name: string; exercise_is_custom: number; category_name: string; category_kind: CategoryKind;
  fields: string | null; exercise_fields: string | null; exercise_builtin_fields: string | null;
};

export async function getPlan(db: Db): Promise<PlanDay[]> {
  const days = await db.getAllAsync<{ weekday: number; is_rest: number }>(
    'SELECT weekday, is_rest FROM plan_days ORDER BY weekday',
  );
  const items = await db.getAllAsync<ItemRow>(
    `SELECT p.*, e.name AS exercise_name, e.is_custom AS exercise_is_custom,
       e.fields AS exercise_fields, e.builtin_fields AS exercise_builtin_fields,
       c.name AS category_name, c.kind AS category_kind
     FROM plan_items p JOIN exercises e ON e.id = p.exercise_id JOIN categories c ON c.id = e.category_id
     ORDER BY p.weekday, p.position`,
  );
  return days.map((d) => ({
    weekday: d.weekday,
    isRest: !!d.is_rest,
    items: items
      .filter((i) => i.weekday === d.weekday)
      .map((i) => ({
        id: i.id,
        position: i.position,
        exerciseId: i.exercise_id,
        exerciseName: i.exercise_name,
        isCustom: !!i.exercise_is_custom,
        categoryName: i.category_name,
        categoryKind: i.category_kind,
        targetSets: i.target_sets,
        targetReps: i.target_reps,
        targetDurationMin: i.target_duration_min,
        targetDistance: i.target_distance,
        targetCount: i.target_count,
        fields: resolveFields(i.category_kind, i.fields, i.exercise_fields, i.exercise_builtin_fields),
        ownFields: i.fields === null ? null : resolveFields(i.category_kind, i.fields),
      })),
  }));
}

export async function setPlanDay(
  db: Db,
  weekday: number,
  day: { isRest: boolean; items: PlanItemInput[] },
): Promise<void> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error(`Invalid weekday: ${weekday}`);
  if (day.isRest && day.items.length > 0) throw new Error('A rest day cannot have exercises');
  // Checked first, so a bad item leaves the day as it was.
  const fields: (string | null)[] = [];
  for (const it of day.items) {
    if (!it.fields) {
      fields.push(null);
      continue;
    }
    const cat = await db.getFirstAsync<{ kind: CategoryKind }>(
      'SELECT c.kind FROM exercises e JOIN categories c ON c.id = e.category_id WHERE e.id = ?', [it.exerciseId],
    );
    if (!cat) throw new Error(`Unknown exercise ${it.exerciseId}`);
    fields.push(serializeFields(normalizeFields(it.fields, cat.kind)));
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plan_days SET is_rest = ? WHERE weekday = ?', [day.isRest ? 1 : 0, weekday]);
    await db.runAsync('DELETE FROM plan_items WHERE weekday = ?', [weekday]);
    for (const [position, it] of day.items.entries()) {
      await db.runAsync(
        `INSERT INTO plan_items (weekday, exercise_id, position, target_sets, target_reps, target_duration_min, target_distance, target_count, fields)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          weekday, it.exerciseId, position, it.targetSets ?? null, it.targetReps ?? null, it.targetDurationMin ?? null,
          it.targetDistance ?? null, it.targetCount ?? null, fields[position],
        ],
      );
    }
  });
}

export async function isPlanComplete(db: Db): Promise<boolean> {
  const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'plan_complete'");
  return r?.value === '1';
}

/**
 * Marks setup done and records the plan as it stands as the one in use from `today`. Called on
 * every save; a second save on the same day replaces that day's record.
 */
export async function markPlanComplete(db: Db, today: string): Promise<void> {
  const plan = await getPlan(db);
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('plan_complete', '1')");
    await db.runAsync('DELETE FROM plan_history WHERE effective_from = ?', [today]);
    for (const d of plan) {
      await db.runAsync(
        'INSERT INTO plan_history (effective_from, weekday, is_rest, exercise_count, kinds) VALUES (?, ?, ?, ?, ?)',
        [today, d.weekday, d.isRest ? 1 : 0, d.items.length, [...new Set(d.items.map((it) => it.categoryKind))].join(',')],
      );
    }
  });
}

export type PlanSnapshotDay = { effectiveFrom: string; weekday: number; isRest: boolean; exerciseCount: number; kinds: CategoryKind[] };

/** Every recorded plan day, newest first. */
export async function getPlanHistory(db: Db): Promise<PlanSnapshotDay[]> {
  const rows = await db.getAllAsync<{ effective_from: string; weekday: number; is_rest: number; exercise_count: number; kinds: string }>(
    'SELECT * FROM plan_history ORDER BY effective_from DESC',
  );
  return rows.map((r) => ({
    effectiveFrom: r.effective_from,
    weekday: r.weekday,
    isRest: !!r.is_rest,
    exerciseCount: r.exercise_count,
    kinds: r.kinds ? (r.kinds.split(',') as CategoryKind[]) : [],
  }));
}
