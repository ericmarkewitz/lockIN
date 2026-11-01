import type { Db } from '@/db/types';
import type { Category, CategoryKind, Exercise } from './types';

type Row = {
  id: number; category_id: number; name: string; is_custom: number;
  category_name: string; category_kind: CategoryKind;
};

const toExercise = (r: Row): Exercise => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  isCustom: !!r.is_custom,
  categoryName: r.category_name,
  categoryKind: r.category_kind,
});

const SELECT = `SELECT e.id, e.category_id, e.name, e.is_custom, c.name AS category_name, c.kind AS category_kind
  FROM exercises e JOIN categories c ON c.id = e.category_id`;

export async function findExercise(db: Db, id: number): Promise<Exercise | null> {
  const r = await db.getFirstAsync<Row>(`${SELECT} WHERE e.id = ?`, [id]);
  return r ? toExercise(r) : null;
}

export async function listCategoriesWithExercises(db: Db): Promise<Category[]> {
  const cats = await db.getAllAsync<{ id: number; name: string; kind: CategoryKind }>(
    'SELECT id, name, kind FROM categories ORDER BY id',
  );
  const exercises = (await db.getAllAsync<Row>(`${SELECT} ORDER BY e.id`)).map(toExercise);
  return cats.map((c) => ({ ...c, exercises: exercises.filter((e) => e.categoryId === c.id) }));
}

export async function addExercise(db: Db, categoryId: number, rawName: string): Promise<Exercise> {
  const name = rawName.trim();
  if (!name) throw new Error('Exercise name is required');
  const dupe = await db.getFirstAsync(
    'SELECT id FROM exercises WHERE category_id = ? AND name = ? COLLATE NOCASE',
    [categoryId, name],
  );
  if (dupe) throw new Error(`"${name}" already exists in this category`);
  const { lastInsertRowId } = await db.runAsync(
    'INSERT INTO exercises (category_id, name, is_custom) VALUES (?, ?, 1)',
    [categoryId, name],
  );
  return (await findExercise(db, lastInsertRowId))!;
}
