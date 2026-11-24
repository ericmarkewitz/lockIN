import type { Db } from '@/db/types';
import { normalizeFields, parseFields, serializeFields, type FieldId } from './fields';
import { LOGGED_SET } from './logged';
import { isPlanComplete, markPlanComplete } from './plan';
import { refreshUntouchedWorkouts } from './workouts';
import type { Category, CategoryKind, Exercise } from './types';

/** Muscle groups lifts are organized by, in display order. */
export const LIFT_SUBCATEGORIES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as const;
/** What the mind and body category is split into, in display order. */
export const MINDBODY_SUBCATEGORIES = ['Yoga', 'Pilates', 'Mobility', 'Mindfulness'] as const;

/** The subcategories each kind of category offers, in display order; empty if it has none. */
export const SUBCATEGORIES: Record<CategoryKind, readonly string[]> = {
  strength: LIFT_SUBCATEGORIES,
  cardio: [],
  mindbody: MINDBODY_SUBCATEGORIES,
};
const SUBCATEGORY_ORDER: readonly string[] = Object.values(SUBCATEGORIES).flat();

/** Heading for a category's exercises that aren't in one of its subcategories. */
export const OTHER_SUBCATEGORY = 'Other';

export type ExerciseGroup = { title: string | null; exercises: Exercise[] };

/**
 * Splits a category's exercises for display. An exercise is listed under its own subcategory and
 * each one in `alsoIn`; Other holds those whose own subcategory isn't offered. Without
 * subcategories there is one untitled group.
 */
export function groupBySubcategory(category: Category): ExerciseGroup[] {
  if (!category.subcategories.length) return [{ title: null, exercises: category.exercises }];
  const groups = category.subcategories.map((title) => ({
    title,
    exercises: category.exercises.filter((e) => e.subcategory === title || e.alsoIn.includes(title)),
  }));
  const other = category.exercises.filter((e) => !category.subcategories.includes(e.subcategory ?? ''));
  return [...groups, { title: OTHER_SUBCATEGORY, exercises: other }].filter((g) => g.exercises.length);
}

type Row = {
  id: number; category_id: number; name: string; is_custom: number; subcategory: string | null; fields: string | null;
  category_name: string; category_kind: CategoryKind;
};

const toExercise = (r: Row, alsoIn: string[]): Exercise => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  isCustom: !!r.is_custom,
  categoryName: r.category_name,
  categoryKind: r.category_kind,
  subcategory: r.subcategory,
  alsoIn,
  fields: parseFields(r.fields, r.category_kind),
});

/** Each exercise's extra subcategories, in display order. */
async function loadAlsoIn(db: Db, exerciseId?: number): Promise<Map<number, string[]>> {
  const rows = await db.getAllAsync<{ exercise_id: number; subcategory: string }>(
    `SELECT exercise_id, subcategory FROM exercise_subcategories${exerciseId === undefined ? '' : ' WHERE exercise_id = ?'}`,
    exerciseId === undefined ? [] : [exerciseId],
  );
  const order = (s: string) => {
    const i = SUBCATEGORY_ORDER.indexOf(s);
    return i === -1 ? SUBCATEGORY_ORDER.length : i;
  };
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.exercise_id, [...(map.get(r.exercise_id) ?? []), r.subcategory]);
  for (const list of map.values()) list.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return map;
}

const SELECT = `SELECT e.id, e.category_id, e.name, e.is_custom, e.subcategory, e.fields, c.name AS category_name, c.kind AS category_kind
  FROM exercises e JOIN categories c ON c.id = e.category_id`;

export async function findExercise(db: Db, id: number): Promise<Exercise | null> {
  const r = await db.getFirstAsync<Row>(`${SELECT} WHERE e.id = ?`, [id]);
  return r ? toExercise(r, (await loadAlsoIn(db, id)).get(id) ?? []) : null;
}

export async function listCategoriesWithExercises(db: Db): Promise<Category[]> {
  const cats = await db.getAllAsync<{ id: number; name: string; kind: CategoryKind }>(
    'SELECT id, name, kind FROM categories ORDER BY id',
  );
  const alsoIn = await loadAlsoIn(db);
  const exercises = (await db.getAllAsync<Row>(`${SELECT} WHERE e.is_hidden = 0 ORDER BY e.id`)).map((r) => toExercise(r, alsoIn.get(r.id) ?? []));
  return cats.map((c) => ({
    ...c,
    subcategories: SUBCATEGORIES[c.kind],
    exercises: exercises.filter((e) => e.categoryId === c.id),
  }));
}

/** Sets an exercise's extra muscle groups, dropping repeats and its own `subcategory`. */
async function setAlsoIn(db: Db, id: number, subcategory: string | null, alsoIn: string[]) {
  await db.runAsync('DELETE FROM exercise_subcategories WHERE exercise_id = ?', [id]);
  for (const s of new Set(alsoIn.filter((s) => s !== subcategory))) {
    await db.runAsync('INSERT INTO exercise_subcategories (exercise_id, subcategory) VALUES (?, ?)', [id, s]);
  }
}

const sameName = (db: Db, categoryId: number, name: string) =>
  db.getFirstAsync<{ id: number; is_hidden: number }>(
    'SELECT id, is_hidden FROM exercises WHERE category_id = ? AND name = ? COLLATE NOCASE',
    [categoryId, name],
  );

/** A custom exercise, or an error saying why it can't be changed. */
async function customExercise(db: Db, id: number): Promise<Exercise> {
  const ex = await findExercise(db, id);
  if (!ex) throw new Error('Exercise not found');
  if (!ex.isCustom) throw new Error("Built-in exercises can't be changed");
  return ex;
}

/** `fields` checked against the category's kind and ready to store; null keeps the category's default. */
async function storedFields(db: Db, categoryId: number, fields: readonly FieldId[] | undefined): Promise<string | null> {
  if (fields === undefined) return null;
  const cat = await db.getFirstAsync<{ kind: CategoryKind }>('SELECT kind FROM categories WHERE id = ?', [categoryId]);
  if (!cat) throw new Error('Category not found');
  return serializeFields(normalizeFields(fields, cat.kind));
}

/**
 * Adds a custom exercise. If one of that name was removed but kept for its logged workouts, it
 * comes back instead, with the name, muscle groups and fields given here.
 */
export async function addExercise(
  db: Db,
  categoryId: number,
  rawName: string,
  subcategory: string | null = null,
  /** More muscle groups to list it under; repeats and `subcategory` itself are ignored. */
  alsoIn: string[] = [],
  /** What it records (see `FIELD_CHOICES`); left out, its category's default. */
  fields?: readonly FieldId[],
): Promise<Exercise> {
  const name = rawName.trim();
  if (!name) throw new Error('Exercise name is required');
  const stored = await storedFields(db, categoryId, fields);
  const dupe = await sameName(db, categoryId, name);
  if (dupe && !dupe.is_hidden) throw new Error(`"${name}" already exists in this category`);
  let id = dupe?.id ?? 0;
  await db.withTransactionAsync(async () => {
    if (dupe) {
      await db.runAsync('UPDATE exercises SET name = ?, subcategory = ?, fields = ?, is_hidden = 0 WHERE id = ?', [name, subcategory, stored, id]);
    } else {
      ({ lastInsertRowId: id } = await db.runAsync(
        'INSERT INTO exercises (category_id, name, is_custom, subcategory, fields) VALUES (?, ?, 1, ?, ?)',
        [categoryId, name, subcategory, stored],
      ));
    }
    await setAlsoIn(db, id, subcategory, alsoIn);
  });
  return (await findExercise(db, id))!;
}

export type ExerciseEdit = {
  name: string; subcategory: string | null; alsoIn: string[];
  /** What it records from now on; left out, unchanged. Values already logged are kept either way. */
  fields?: readonly FieldId[];
};

/** Renames a custom exercise and sets its muscle groups and fields. Workouts it was logged in show the new name. */
export async function updateExercise(db: Db, id: number, edit: ExerciseEdit): Promise<Exercise> {
  const ex = await customExercise(db, id);
  const name = edit.name.trim();
  if (!name) throw new Error('Exercise name is required');
  const dupe = await sameName(db, ex.categoryId, name);
  if (dupe && dupe.id !== id) {
    throw new Error(dupe.is_hidden
      ? `You removed an exercise called "${name}". Create it again from search to bring it back.`
      : `"${name}" already exists in this category`);
  }
  const fields = edit.fields === undefined ? undefined : await storedFields(db, ex.categoryId, edit.fields);
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE exercises SET name = ?, subcategory = ? WHERE id = ?', [name, edit.subcategory, id]);
    if (fields !== undefined) await db.runAsync('UPDATE exercises SET fields = ? WHERE id = ?', [fields, id]);
    await setAlsoIn(db, id, edit.subcategory, edit.alsoIn);
  });
  return (await findExercise(db, id))!;
}

export type ExerciseUsage = {
  /** Weekdays (0 = Sunday) the weekly plan has it on, ascending. */
  plannedWeekdays: number[];
  /** Workouts with at least one set of it logged. */
  loggedWorkouts: number;
};

export async function getExerciseUsage(db: Db, id: number): Promise<ExerciseUsage> {
  const days = await db.getAllAsync<{ weekday: number }>(
    'SELECT DISTINCT weekday FROM plan_items WHERE exercise_id = ? ORDER BY weekday',
    [id],
  );
  const logged = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(DISTINCT we.workout_id) AS n FROM workout_exercises we
     JOIN sets s ON s.workout_exercise_id = we.id WHERE we.exercise_id = ? AND ${LOGGED_SET}`,
    [id],
  );
  return { plannedWeekdays: days.map((d) => d.weekday), loggedWorkouts: logged?.n ?? 0 };
}

/**
 * Removes a custom exercise from the exercise list and the weekly plan. Upcoming workouts with
 * nothing logged or changed by hand follow the new plan. If a workout still has the exercise it
 * is hidden rather than deleted, so that workout keeps it; otherwise it is deleted.
 */
export async function removeExercise(db: Db, id: number, today: string): Promise<'deleted' | 'hidden'> {
  await customExercise(db, id);
  const planned = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM plan_items WHERE exercise_id = ?', [id]);
  if (planned?.n) {
    // Gaps left in `position` are harmless: items are only ever ordered by it.
    await db.runAsync('DELETE FROM plan_items WHERE exercise_id = ?', [id]);
    if (await isPlanComplete(db)) await markPlanComplete(db, today);
    await refreshUntouchedWorkouts(db, today);
  }
  const used = await db.getFirstAsync('SELECT 1 FROM workout_exercises WHERE exercise_id = ?', [id]);
  if (used) {
    await db.runAsync('UPDATE exercises SET is_hidden = 1 WHERE id = ?', [id]);
    return 'hidden';
  }
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
  return 'deleted';
}

/**
 * Exercises to do instead of `exerciseId` when it can't be done today: the others in its category
 * that work any of the same muscle groups (its own group's first), or the whole category when it
 * has none. Leaves out hidden exercises and those in `exclude`, e.g. the rest of the day.
 */
export async function findSimilarExercises(db: Db, exerciseId: number, exclude: readonly number[] = []): Promise<Exercise[]> {
  const target = await findExercise(db, exerciseId);
  if (!target) return [];
  const category = (await listCategoriesWithExercises(db)).find((c) => c.id === target.categoryId);
  const groups = [target.subcategory, ...target.alsoIn].filter((g): g is string => !!g);
  const groupsOf = (e: Exercise) => [e.subcategory, ...e.alsoIn];
  // 0: same own group; 1: listed under the target's own group; 2: shares another group.
  const rank = (e: Exercise) => (e.subcategory === target.subcategory ? 0 : groupsOf(e).includes(target.subcategory) ? 1 : 2);
  const candidates = (category?.exercises ?? [])
    .filter((e) => e.id !== exerciseId && !exclude.includes(e.id))
    .filter((e) => !groups.length || groupsOf(e).some((g) => !!g && groups.includes(g)));
  return groups.length ? candidates.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map((x) => x.e) : candidates;
}

export type SearchResult = {
  /** Matches in the category being browsed. */
  here: Exercise[];
  /** Matches in every other category. */
  elsewhere: Exercise[];
  /** The query is already the name of an exercise in the category being browsed. */
  exact: boolean;
};

/** Case-insensitive match on an exercise's name or subcategory (e.g. a muscle group), split by the category being browsed. */
export function searchExercises(categories: Category[], activeId: number, query: string): SearchResult {
  const q = query.trim().toLowerCase();
  const matches = (e: Exercise) =>
    [e.name, e.subcategory, ...e.alsoIn].some((s) => !!s?.toLowerCase().includes(q));
  const here = categories.find((c) => c.id === activeId)?.exercises ?? [];
  return {
    here: here.filter(matches),
    elsewhere: categories.filter((c) => c.id !== activeId).flatMap((c) => c.exercises.filter(matches)),
    exact: here.some((e) => e.name.toLowerCase() === q),
  };
}
