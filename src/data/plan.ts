import type { Db } from '@/db/types';
import type { CategoryKind, PlanDay, PlanItemInput } from './types';

type ItemRow = {
  id: number; weekday: number; exercise_id: number; position: number;
  target_sets: number | null; target_reps: number | null;
  target_duration_min: number | null; target_distance: number | null;
  exercise_name: string; category_name: string; category_kind: CategoryKind;
};

export async function getPlan(db: Db): Promise<PlanDay[]> {
  const days = await db.getAllAsync<{ weekday: number; is_rest: number }>(
    'SELECT weekday, is_rest FROM plan_days ORDER BY weekday',
  );
  const items = await db.getAllAsync<ItemRow>(
    `SELECT p.*, e.name AS exercise_name, c.name AS category_name, c.kind AS category_kind
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
        categoryName: i.category_name,
        categoryKind: i.category_kind,
        targetSets: i.target_sets,
        targetReps: i.target_reps,
        targetDurationMin: i.target_duration_min,
        targetDistance: i.target_distance,
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
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plan_days SET is_rest = ? WHERE weekday = ?', [day.isRest ? 1 : 0, weekday]);
    await db.runAsync('DELETE FROM plan_items WHERE weekday = ?', [weekday]);
    for (const [position, it] of day.items.entries()) {
      await db.runAsync(
        `INSERT INTO plan_items (weekday, exercise_id, position, target_sets, target_reps, target_duration_min, target_distance)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [weekday, it.exerciseId, position, it.targetSets ?? null, it.targetReps ?? null, it.targetDurationMin ?? null, it.targetDistance ?? null],
      );
    }
  });
}

export async function isPlanComplete(db: Db): Promise<boolean> {
  const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'plan_complete'");
  return r?.value === '1';
}

export async function markPlanComplete(db: Db): Promise<void> {
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('plan_complete', '1')");
}
