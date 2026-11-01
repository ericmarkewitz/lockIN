import { addExercise, findExercise, listCategoriesWithExercises } from '../exercises';
import { createTestDb } from '@/test/testDb';

describe('exercises', () => {
  it('groups exercises under categories', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    expect(cats.map((c) => c.name)).toEqual(expect.arrayContaining(['Lifts', 'Cardio', 'Yoga']));
    const cardio = cats.find((c) => c.name === 'Cardio')!;
    expect(cardio.kind).toBe('cardio');
    expect(cardio.exercises.map((e) => e.name)).toContain('Running');
  });

  it('adds a custom exercise to a category', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    const lifts = cats.find((c) => c.name === 'Lifts')!;
    const ex = await addExercise(db, lifts.id, '  Hip Thrust ');
    expect(ex.name).toBe('Hip Thrust');
    expect(ex.isCustom).toBe(true);
    expect((await findExercise(db, ex.id))?.categoryKind).toBe('strength');
  });

  it('rejects blank and duplicate names (case-insensitive)', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await expect(addExercise(db, lifts.id, '   ')).rejects.toThrow(/name/i);
    await expect(addExercise(db, lifts.id, 'bench press')).rejects.toThrow(/exists/i);
  });
});
