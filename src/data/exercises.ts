import type { Db } from '@/db/types';
import type { Category, CategoryKind, Exercise } from './types';

/** Muscle groups lifts are organized by, in display order. */
export const LIFT_SUBCATEGORIES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as const;

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
  id: number; category_id: number; name: string; is_custom: number; subcategory: string | null;
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
});

/** Each exercise's extra subcategories, in display order. */
async function loadAlsoIn(db: Db, exerciseId?: number): Promise<Map<number, string[]>> {
  const rows = await db.getAllAsync<{ exercise_id: number; subcategory: string }>(
    `SELECT exercise_id, subcategory FROM exercise_subcategories${exerciseId === undefined ? '' : ' WHERE exercise_id = ?'}`,
    exerciseId === undefined ? [] : [exerciseId],
  );
  const order = (s: string) => {
    const i = (LIFT_SUBCATEGORIES as readonly string[]).indexOf(s);
    return i === -1 ? LIFT_SUBCATEGORIES.length : i;
  };
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.exercise_id, [...(map.get(r.exercise_id) ?? []), r.subcategory]);
  for (const list of map.values()) list.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return map;
}

const SELECT = `SELECT e.id, e.category_id, e.name, e.is_custom, e.subcategory, c.name AS category_name, c.kind AS category_kind
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
  const exercises = (await db.getAllAsync<Row>(`${SELECT} ORDER BY e.id`)).map((r) => toExercise(r, alsoIn.get(r.id) ?? []));
  return cats.map((c) => ({
    ...c,
    subcategories: c.kind === 'strength' ? LIFT_SUBCATEGORIES : [],
    exercises: exercises.filter((e) => e.categoryId === c.id),
  }));
}

export async function addExercise(
  db: Db,
  categoryId: number,
  rawName: string,
  subcategory: string | null = null,
): Promise<Exercise> {
  const name = rawName.trim();
  if (!name) throw new Error('Exercise name is required');
  const dupe = await db.getFirstAsync(
    'SELECT id FROM exercises WHERE category_id = ? AND name = ? COLLATE NOCASE',
    [categoryId, name],
  );
  if (dupe) throw new Error(`"${name}" already exists in this category`);
  const { lastInsertRowId } = await db.runAsync(
    'INSERT INTO exercises (category_id, name, is_custom, subcategory) VALUES (?, ?, 1, ?)',
    [categoryId, name, subcategory],
  );
  return (await findExercise(db, lastInsertRowId))!;
}

export type SearchResult = {
  /** Matches in the category being browsed. */
  here: Exercise[];
  /** Matches in every other category. */
  elsewhere: Exercise[];
  /** The query is already the name of an exercise in the category being browsed. */
  exact: boolean;
};

/** Case-insensitive match on an exercise's name or muscle group, split by the category being browsed. */
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
